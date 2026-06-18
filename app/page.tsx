"use client";

import { HoleBackground } from "@/components/animate-ui/components/backgrounds/hole";
import { BlueTitle, GrayTitle } from "@/components/reusables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLACEHOLDERS, SUGGESTIONS } from "@/lib/data";
import { cn } from "@/lib/utils";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Monitor, Tablet, Smartphone, Zap, FileText, Terminal, Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [buildProgress, setBuildProgress] = useState(48);
  const [deployStatus, setDeployStatus] = useState<"Building" | "Testing" | "Ready" | "Deployed">("Building");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  useEffect(() => {
    if (isFocused || prompt) return;
    const t = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(t);
  }, [isFocused, prompt]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [prompt]);
      const handleSubmit = () => {
    if (!prompt.trim() || !isSignedIn) return;
    router.push(`/workspace?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestion = (s: string) => {
    setPrompt(s);
    textareaRef.current?.focus();
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] selection:bg-white/20">
      <section className="relative flex flex-col items-center overflow-hidden px-4 pb-24 pt-40 text-center">
        <HoleBackground
          strokeColor="rgba(255,255,255,0.05)"
          className="absolute inset-0 h-full w-full"
          style={{
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0, 0,0,0.5) 50%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
          }}
        />

        <Badge variant={"outline"} className="gap-2 p-4 backdrop-blur-sm">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Powered by Gemini 3.5 Flash
        </Badge>

        <h1 className="mx-auto max-w-3xl text-balance text-5xl leading-tight sm:text-5xl lg:text-7xl z-10">
          <GrayTitle>Forge your dream</GrayTitle>
          <br />
          <BlueTitle>from a single prompt.</BlueTitle>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-white/40 z-10">
          Describe what you want to build. AI writes the code, picks the packages, and renders a live preview all inside your browser.
        </p>

        {/* Prompt Box */}
        <div className="relative mx-auto mt-12 w-full max-w-2xl">
          <div className={cn("rounded-2xl border bg-[#111111] duration-200", isFocused ? "border-white/20 ring-1 ring-white/8" : "border-white/8")}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full resize-none bg-transparent px-5 pb-4 pt-5 text-sm placeholder:text-white/20 focus:outline-none sm:text-base"
              style={{ minHeight: 56, maxHeight: 200 }}
              placeholder={PLACEHOLDERS[placeholderIndex]}
            />

            <div className="flex items-center justify-between border-t border-white/6 px-4 py-2.5">
              <span className="text-xs text-white/20">Press ⏎ to generate · Shift+⏎ for new line</span>

              {isSignedIn ? (
                <Button onClick={handleSubmit} disabled={!prompt.trim()} className={"h-8 rounded-full px-5 font-semibold"} variant={prompt.trim() ? "default" : "secondary"}>
                  Generate
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <SignInButton mode="modal">
                  <Button className={"h-8 rounded-full bg-white px-5 font-semibold"}>
                    Generate
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => handleSuggestion(s)} className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-white/40 hover:border-white/15 hover:bg-white/8 hover:text-white/70">
                {s}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-10 text-xs text-white/20">No credit card required · 10 free generations on sign up</p>
      </section>

      {/* Browser Preview UI */}
      <section className="mx-auto mt-12 w-full max-w-6xl px-4 pb-24">
        <div className="relative rounded-2xl bg-linear-to-b from-white/3 to-white/2 p-3 shadow-2xl shadow-black/60">
          {/* Toolbar */}
          <div className="flex items-center gap-4 rounded-xl bg-white/5 px-3 py-2 backdrop-blur-md">
            {/* Traffic lights */}
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500 ring-1 ring-black/40" />
              <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-black/40" />
              <span className="h-3 w-3 rounded-full bg-emerald-400 ring-1 ring-black/40" />
            </div>

            {/* Tabs */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className="px-3 py-1 rounded-tl-lg rounded-bl-lg bg-white/6 text-sm text-white/80">Preview.appbuilder.ai</div>
                <div className="px-3 py-1 rounded-tr-lg rounded-br-lg bg-white/2 text-sm text-white/60">Settings</div>
              </div>
            </div>

            {/* Address bar */}
            <div className="ml-3 flex grow items-center gap-3 rounded-xl bg-[#0b0b0b]/60 px-3 py-2 ring-1 ring-white/6">
              <div className="flex items-center gap-2 text-white/50">
                <button className="p-1 rounded-md hover:bg-white/3"><ChevronLeft className="h-4 w-4" /></button>
                <button className="p-1 rounded-md hover:bg-white/3"><ChevronRight className="h-4 w-4" /></button>
                <button className="p-1 rounded-md hover:bg-white/3"><RefreshCw className="h-4 w-4" /></button>
              </div>

              <div className="flex items-center gap-3 grow">
                <div className="flex items-center gap-2 rounded-md bg-white/6 px-3 py-1 text-sm text-white/70 w-full">
                  <svg className="h-3 w-3 text-white/50" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
                  <span className="truncate">localhost:3000</span>
                </div>

                {/* AI status */}
                <div className="flex items-center gap-2">
                  <div className="text-xs text-white/50">AI:</div>
                  <div className="rounded-full bg-linear-to-r from-indigo-600 to-violet-500 px-3 py-1 text-xs font-medium text-white shadow-sm">Building...</div>
                </div>
              </div>
            </div>

            {/* Device icons */}
            <div className="ml-3 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md bg-white/3 px-2 py-1 text-sm text-white/70">
                <button onClick={() => setPreviewDevice("desktop")} className="p-1 hover:bg-white/4 rounded-md"><Monitor className="h-4 w-4" /></button>
                <button onClick={() => setPreviewDevice("tablet")} className="p-1 hover:bg-white/4 rounded-md"><Tablet className="h-4 w-4" /></button>
                <button onClick={() => setPreviewDevice("mobile")} className="p-1 hover:bg-white/4 rounded-md"><Smartphone className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full rounded-full bg-white/6">
            <div className="h-2 rounded-full bg-linear-to-r from-indigo-500 to-violet-400 transition-all" style={{ width: `${buildProgress}%` }} />
          </div>

          {/* Frame */}
          <div className="mt-4 flex min-h-105 overflow-hidden rounded-lg bg-[#070707] shadow-inner">
            {/* Left: preview */}
            <div className="relative flex-1 p-6">
              <div className="mx-auto h-full max-w-full rounded-lg border border-white/6 bg-linear-to-b from-white/2 to-white/3 overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/6 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-white/60">Device:</div>
                    <div className="flex items-center gap-2">
                      <button className={`px-3 py-1 rounded-md text-xs ${previewDevice === "desktop" ? "bg-white/5 text-white" : "text-white/50"}`}>Desktop</button>
                      <button className={`px-3 py-1 rounded-md text-xs ${previewDevice === "tablet" ? "bg-white/5 text-white" : "text-white/50"}`}>Tablet</button>
                      <button className={`px-3 py-1 rounded-md text-xs ${previewDevice === "mobile" ? "bg-white/5 text-white" : "text-white/50"}`}>Mobile</button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs text-white/40">Preview URL</div>
                    <div className="text-xs text-white/60">preview.appbuilder.ai</div>
                  </div>
                </div>

                <div className="flex h-85 items-stretch justify-center p-6">
                  <div className="w-full max-w-full rounded-md border border-white/6 bg-[#0b0b0b] p-6 text-white/60">
                    <div className="animate-pulse text-sm">Rendering app preview skeleton…</div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="h-24 rounded bg-white/3" />
                      <div className="h-24 rounded bg-white/4" />
                      <div className="h-24 rounded bg-white/3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: AI Assistant panel */}
            <aside className="w-80 border-l border-white/6 bg-[#060606]/80 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-linear-to-r from-indigo-600 to-violet-500 p-2 text-white shadow">AI</div>
                  <div className="text-sm font-semibold text-white">AI Assistant</div>
                </div>
                <div className="text-xs text-white/40">Live</div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs text-white/40">Current task</div>
                  <div className="mt-1 rounded-md bg-white/6 px-3 py-2 text-sm text-white/80">Building application preview</div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/40">Generated files</div>
                    <div className="text-xs text-white/50">3 files</div>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-white/60">
                    <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-white/40" /> src/App.tsx</li>
                    <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-white/40" /> components/Header.tsx</li>
                    <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-white/40" /> styles/app.css</li>
                  </ul>
                </div>

                <div>
                  <div className="text-xs text-white/40">Build logs</div>
                  <div className="mt-2 rounded-md bg-[#050505] p-2 text-xs text-white/50">
                    <div className="flex items-center gap-2"><Terminal className="h-4 w-4" /> <span>Installing dependencies…</span></div>
                    <div className="mt-2 flex items-center gap-2"><Activity className="h-4 w-4" /> <span>Compiling modules</span></div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-white/40">AI reasoning</div>
                  <div className="mt-2 rounded-md bg-white/6 p-2 text-xs text-white/60">
                    <ol className="list-decimal pl-4">
                      <li>Analyze prompt</li>
                      <li>Select stack & packages</li>
                      <li>Generate components & styles</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>AI ops</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-white/6 px-2 py-1 text-xs text-white/80">Building</div>
                </div>
              </div>
            </aside>
          </div>

          {/* Footer: deployment status chips */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <div className="rounded-full bg-white/6 px-3 py-1 text-xs">Building</div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-xs">Testing</div>
              <div className="rounded-full bg-emerald-600/80 px-3 py-1 text-xs text-white">Ready</div>
              <div className="rounded-full bg-indigo-600 px-3 py-1 text-xs text-white">Deployed</div>
            </div>

            <div className="text-sm text-white/40">Last updated 2m ago</div>
          </div>
        </div>
      </section>
    </main>
  );
}
