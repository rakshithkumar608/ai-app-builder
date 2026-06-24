import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import { db } from "@/lib/prisma";
import { FileData, Message } from "@/types/workspace";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { aj } from "@/lib/arcjet";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

//  SSE helper ------------

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({
    type,
    ...(payload as object),
  })}\n\n`;
}

// ─── Extract short label from a Gemini thought chunk ─────────────────────────
// Gemini thoughts often start with a bold heading like **Verify Config**
// We extract that. If no bold heading, take the first sentence only.

function extractThoughtLabel(text: string): string | null {
  //  Try to grab **bold heading** at the start
  const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  //  Fall back to first sentence
  const sentence = text.split(/[.!?]/)[0].trim();
  if (sentence.length >= 8 && sentence.length <= 80) return sentence;

  return null;
}

// ─── Retry with exponential backoff ──────────────────────────────────────────
// Retries the given async fn up to `maxAttempts` times when it throws a 503.
// Waits 2^attempt * 1000 ms between each attempt (2s, 4s, 8s...).

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  onRetry?: (attempt: number) => void,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      // Only retry on 503 Service Unavailable
      if (status !== 503 || attempt === maxAttempts - 1) throw err;
      const delayMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      onRetry?.(attempt + 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// ------ npm vbalidation -----

async function validateDependencies(
  deps: Record<string, string>,
): Promise<Record<string, string>> {
  const valid: Record<string, string> = {};
  await Promise.all(
    Object.entries(deps).map(async ([pkg, version]) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) valid[pkg] = version;
      } catch {
        // silently skip hallucination packages
      }
    }),
  );
  return valid;
}

// ─── History trimming ------

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}

//  ---- System prompt -------------

const SYSTEM_PROMPT = `You are an expert React developer. Your job is to generate complete, working React applications based on user prompts. 

RULES: 
1.Always respond with a valid JSON object - no markdown fences, no extra text.
2. The JSON must match this exact shape:

{
    "assistantMessage": "<brief explanation of what you built/changed>",
    "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
    "files": {
    "/App.js": { "code": "<full file content>" },
    "/components/SomeComponent.js": { "code": "<full file content>" }
    },
    "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + hooks). Do NOT use TypeScript in generated files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The entry point must always be /App.js and must export a default component.
6. All imports must reference files you include in "files" or packages in "dependencies".
7. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always available.
8. When modifying existing code, include ALL files (both changed and unchanged) in "files".
9. Keep code clean, readable, and production-quality.
10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.

`;

// ------------- Gemini contents builder --------

function buildContents(messages: Message[], fileData: FileData | null) {
  const trimmed = trimHistory(messages);

  return trimmed.map((msg, idx) => {
    const role = msg.role === "assistant" ? "model" : "user";

    if (msg.role === "user") {
      const parts: object[] = [];

      let text = msg.content;

      if (msg.imageUrl) {
        text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background0image, etc.):${msg.imageUrl}]\n\n${text}`;
      }

      const isLast = idx === trimmed.length - 1;
      if (isLast && fileData) {
        text +=
          "\n\nCurrent project files for content:\n" +
          JSON.stringify(fileData, null, 2);
      }
      parts.push({ text });
      return { role, parts };
    }
    return { role, parts: [{ text: msg.content }] };
  });
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { workspaceId, userId, messages, fileData } = body as {
    workspaceId: string | null;
    userId: string;
    messages: Message[];
    fileData: FileData | null;
  };

  if (!messages?.length) {
    return Response.json(
      {
        message: "No messages provided",
      },
      { status: 400 },
    );
  }

  // --- Arcjet: rate limit, prompt injection, sensitive info -----------
  // Reconstruct a new Request with the same body for Arcjet to read
  const arcjetReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(body),
  });

  
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const decision = await aj.protect(req, {
    requested: 1,
    userId: clerkId,
    detectPromptInjectionMessage: lastUserMessage,
    // Explicitly pass the text to scan so Arcjet doesn't auto-read the body (fixes deprecation warning)
    sensitiveInfoValue: lastUserMessage,
  });

  if (decision.isDenied()) {
    // Returns the reason type as the message - rateLimit, bot, promptInjection, etc.
    return Response.json(
      { message: decision.reason?.type ?? "Request blocked" },
      { status: 429 },
    );
  }

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, credits: true },
  });

  if (!user)
    return Response.json(
      {
        message: "User not found",
      },
      {
        status: 400,
      },
    );

  if (user.credits < CREDIT_COST_PER_GENERATION) {
    return Response.json(
      {
        message: "Insufficient credits",
      },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      try {
        const contents = buildContents(messages, fileData);

        const geminiStream = await withRetry(
          () =>
            ai.models.generateContentStream({
              model: "gemini-3.5-flash",
              contents,
              config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.7,
                //  Force JSON output - Gemini will never wrap the response in markdown
                responseMimeType: "application/json",
                thinkingConfig: {
                  includeThoughts: true,
                },
              },
            }),
          3,
          (attempt) => {
            enqueue(sseEvent("status", { message: `Retrying... (attempt ${attempt}/3)` }));
          },
        );

        let accumulated = ""; // collects the actual JSON output chunks
        let lastEmitTime = 0; // used to throttle thought -> status emission

        for await (const chunk of geminiStream) {
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];

          for (const part of parts) {
            if (!part.text) continue;

            if (part.thought) {
              // Extract just the short label - not the full wall of text
              const now = Date.now();
              if (now - lastEmitTime > 600) {
                const label = extractThoughtLabel(part.text);
                if (label) {
                  enqueue(sseEvent("status", { message: label }));
                  lastEmitTime = now;
                }
              }
            } else {
              // Non-thought parts are the actual JSON output - accumulate them
              accumulated += part.text;
            }
          }
        }

        //  ---- Parse JSON ------
        //  If Gemini returns malformed JSON we abort here without deducting a credit.
        // This is the  "no charge on AI failure" guarantee.

        let parsed: {
          assistantMessage: string;
          title?: string;
          files: Record<string, { code: string }>;
          dependencies: Record<string, string>;
        };

        try {
          parsed = JSON.parse(accumulated);
        } catch (error) {
          enqueue(
            sseEvent("error", {
              message: "AI returned invalid JSON. Please try again.",
            }),
          );
          controller.close();
          return;
        }

        //  ----- Validate npm packages --------
        //  Gemini sometimes halucinates packages names that don't exists on npm.
        // We hit the npm registry for each dep and silenmtly drop any fakes.
        // Real packages pass through unchaged.

        const {
          assistantMessage,
          title: aiTitle,
          files,
          dependencies,
        } = parsed;

        enqueue(sseEvent("status", { message: "Validating  packages..." }));
        const validatedDeps = await validateDependencies(dependencies ?? {});
        const newFileData: FileData = {
          files,
          dependencies: validatedDeps,
          title: aiTitle,
        };

        // ---Upsert workspace + deduct credit (single transaction) -----
        //  Atomic: if either the DB write or the credit fails,
        // neither happens - user never loses a credit on a failed save.
        // workspaceId is null on first generation -> credit, string -> update.

        enqueue(sseEvent("status", { message: "Saving project..." }));

        const lastUserMsg = messages[messages.length - 1];
        const updateMessages: Message[] = [
          ...messages,
          { role: "assistant", content: assistantMessage },
        ];

        const [workspace] = await db.$transaction([
          workspaceId
            ? db.workspace.update({
                where: { id: workspaceId, userId },
                data: {
                  messages: updateMessages as never,
                  fileData: newFileData as never,
                },
              })
            : db.workspace.create({
                data: {
                  userId,
                  title: aiTitle ?? lastUserMsg.content.slice(0, 80),
                  messages: updateMessages as never,
                  fileData: newFileData as never,
                },
              }),

          db.user.update({
            where: { id: userId },
            data: {
              credits: {
                decrement: CREDIT_COST_PER_GENERATION,
              },
            },
          }),
        ]);

        // Re-fetch updated credit balance to return accurate value to the client.
        //  The client updates its local credits state from this - no page refresh needed.

        const updatedUser = await db.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });

        // ---- Final done event ------
        //  Client receives this, updates Sandpack with the new files,
        // adds the assistant message to the chat, and updates the credit badge.
        enqueue(
          sseEvent("done", {
            workspaceId: workspace.id,
            assistantMessage,
            fileData: newFileData,
            creditsRemaining:
              updatedUser?.credits ?? user.credits - CREDIT_COST_PER_GENERATION,
          }),
        );
      } catch (error) {
        console.error("[gen-ai-code] stream error:", error);
        const status = (error as { status?: number })?.status;
        const message =
          status === 503
            ? "Gemini is overloaded right now. Please try again in a moment."
            : "Stream failed. Please try again.";
        enqueue(sseEvent("error", { message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel fluid - 300s timeout for long generation
