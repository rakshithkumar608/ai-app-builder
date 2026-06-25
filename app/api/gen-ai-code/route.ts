import { CREDIT_COST_PER_GENERATION } from "@/lib/constants";
import { db } from "@/lib/prisma";
import { FileData, Message } from "@/types/workspace";
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { aj } from "@/lib/arcjet";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Model to use ────────────────────────────────────────────────────────────
// kimi-k2-instruct-0905: 1T param MoE, 262k context, excellent at code gen
const GROQ_MODEL = "moonshotai/kimi-k2-instruct-0905";

//  SSE helper ------------

function sseEvent(type: string, payload: unknown): string {
  return `data: ${JSON.stringify({
    type,
    ...(payload as object),
  })}\n\n`;
}

// ─── Retry with exponential backoff ──────────────────────────────────────────
// Retries up to `maxAttempts` times on 429 (rate limit) or 503 (overload).
// For 429, respects the Retry-After header / message delay.

function parseRetryDelay(err: unknown): number | null {
  try {
    // Groq/OpenAI errors may carry a headers object or message with delay
    const headers = (err as { headers?: Record<string, string> })?.headers;
    if (headers?.["retry-after"]) {
      return parseInt(headers["retry-after"], 10) * 1000;
    }
    const msg = (err as { message?: string })?.message ?? "";
    const match = msg.match(/retry after (\d+)/i) ?? msg.match(/(\d+)\s*second/i);
    if (match) return parseInt(match[1], 10) * 1000;
  } catch {
    // ignore
  }
  return null;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  onRetry?: (attempt: number, delayMs: number) => void,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = status === 503 || status === 429;
      if (!isRetryable || attempt === maxAttempts - 1) throw err;
      const delayMs =
        status === 429
          ? (parseRetryDelay(err) ?? Math.pow(2, attempt + 1) * 1000)
          : Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      onRetry?.(attempt + 1, delayMs);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// ------ npm validation -----

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
        // silently skip hallucinated packages
      }
    }),
  );
  return valid;
}

// ─── History trimming ──────────────────────────────────────────────────────

function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}

// ─── System prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert React developer. Your job is to generate complete, working React applications based on user prompts.

RULES:
1. Always respond with a valid JSON object - no markdown fences, no extra text.
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
11. Output ONLY the raw JSON object. Do not wrap it in markdown code fences or add any text before or after.
`;

// ─── Build Groq messages array ─────────────────────────────────────────────

function buildMessages(
  messages: Message[],
  fileData: FileData | null,
): Groq.Chat.ChatCompletionMessageParam[] {
  const trimmed = trimHistory(messages);

  const chatMessages: Groq.Chat.ChatCompletionMessageParam[] = trimmed.map(
    (msg, idx) => {
      if (msg.role === "assistant") {
        return { role: "assistant", content: msg.content };
      }

      let text = msg.content;

      if (msg.imageUrl) {
        text = `[The user has attached an image. Use this URL directly in the generated app where relevant (as img src, background-image, etc.): ${msg.imageUrl}]\n\n${text}`;
      }

      const isLast = idx === trimmed.length - 1;
      if (isLast && fileData) {
        text +=
          "\n\nCurrent project files for context:\n" +
          JSON.stringify(fileData, null, 2);
      }

      return { role: "user", content: text };
    },
  );

  return chatMessages;
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
    return Response.json({ message: "No messages provided" }, { status: 400 });
  }

  // --- Arcjet: rate limit, prompt injection, sensitive info -----------
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const decision = await aj.protect(req, {
    requested: 1,
    userId: clerkId,
    detectPromptInjectionMessage: lastUserMessage,
    sensitiveInfoValue: lastUserMessage,
  });

  if (decision.isDenied()) {
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
    return Response.json({ message: "User not found" }, { status: 400 });

  if (user.credits < CREDIT_COST_PER_GENERATION) {
    return Response.json({ message: "Insufficient credits" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      try {
        const chatMessages = buildMessages(messages, fileData);

        enqueue(sseEvent("status", { message: "Thinking..." }));

        // ─── Stream from Groq ───────────────────────────────────────────
        // We stream text chunks and accumulate the full JSON string.
        // NOTE: We do NOT use response_format: json_object with streaming
        // because Groq doesn't support that combination. Instead we prompt
        // the model strictly and parse JSON from the accumulated output.

        const groqStream = await withRetry(
          () =>
            groq.chat.completions.create({
              model: GROQ_MODEL,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...chatMessages,
              ],
              stream: true,
              temperature: 0.6,
              max_tokens: 32768,
            }),
          3,
          (attempt, delayMs) => {
            const delaySec = Math.round(delayMs / 1000);
            enqueue(
              sseEvent("status", {
                message: `Rate limited — retrying in ${delaySec}s (attempt ${attempt}/3)…`,
              }),
            );
          },
        );

        let accumulated = "";
        let charCount = 0;
        const STATUS_MESSAGES = [
          "Designing components...",
          "Writing React code...",
          "Adding styles...",
          "Building app logic...",
          "Wiring up state...",
          "Almost done...",
        ];
        let statusIdx = 0;
        // Emit a status update every ~800 chars to keep the user informed
        const STATUS_INTERVAL = 800;

        for await (const chunk of groqStream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (!delta) continue;

          accumulated += delta;
          charCount += delta.length;

          // Emit progress status messages at intervals
          if (charCount >= STATUS_INTERVAL * (statusIdx + 1) && statusIdx < STATUS_MESSAGES.length) {
            enqueue(sseEvent("status", { message: STATUS_MESSAGES[statusIdx] }));
            statusIdx++;
          }
        }

        enqueue(sseEvent("status", { message: "Parsing response..." }));

        // ─── Extract JSON from the accumulated string ───────────────────
        // The model may occasionally wrap output in ```json ... ``` fences
        // despite our instructions. Strip them defensively.
        const cleaned = accumulated
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();

        let parsed: {
          assistantMessage: string;
          title?: string;
          files: Record<string, { code: string }>;
          dependencies: Record<string, string>;
        };

        try {
          parsed = JSON.parse(cleaned);
        } catch {
          enqueue(
            sseEvent("error", {
              message: "AI returned invalid JSON. Please try again.",
            }),
          );
          controller.close();
          return;
        }

        const { assistantMessage, title: aiTitle, files, dependencies } = parsed;

        // ─── Validate npm packages ──────────────────────────────────────
        enqueue(sseEvent("status", { message: "Validating packages..." }));
        const validatedDeps = await validateDependencies(dependencies ?? {});
        const newFileData: FileData = {
          files,
          dependencies: validatedDeps,
          title: aiTitle,
        };

        // ─── Upsert workspace + deduct credit (atomic transaction) ──────
        enqueue(sseEvent("status", { message: "Saving project..." }));

        const updateMessages: Message[] = [
          ...messages,
          { role: "assistant", content: assistantMessage },
        ];

        const lastUserMsg = messages[messages.length - 1];

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
            data: { credits: { decrement: CREDIT_COST_PER_GENERATION } },
          }),
        ]);

        const updatedUser = await db.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });

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
          status === 429
            ? "Groq rate limit reached. Please wait a moment and try again."
            : status === 503
              ? "Groq is overloaded right now. Please try again in a moment."
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
      "X-Accel-Buffering": "no",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
