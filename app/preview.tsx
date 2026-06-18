import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  Zap,
  FileText,
  Terminal,
  Activity,
} from "lucide-react";
import { useState } from "react";

export default function Preview() {
  const [buildProgress, setBuildProgress] = useState(48);
  const [deployStatus, setDeployStatus] = useState<
    "Building" | "Testing" | "Ready" | "Deployed"
  >("Building");
  const [previewDevice, setPreviewDevice] = useState<
    "desktop" | "tablet" | "mobile"
  >("desktop");
  return (
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
                <div className="px-3 py-1 rounded-tl-lg rounded-bl-lg bg-white/6 text-sm text-white/80">
                  Preview.appbuilder.ai
                </div>
                <div className="px-3 py-1 rounded-tr-lg rounded-br-lg bg-white/2 text-sm text-white/60">
                  Settings
                </div>
              </div>
            </div>

            {/* Address bar */}
            <div className="ml-3 flex grow items-center gap-3 rounded-xl bg-[#0b0b0b]/60 px-3 py-2 ring-1 ring-white/6">
              <div className="flex items-center gap-2 text-white/50">
                <button className="p-1 rounded-md hover:bg-white/3">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="p-1 rounded-md hover:bg-white/3">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="p-1 rounded-md hover:bg-white/3">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 grow">
                <div className="flex items-center gap-2 rounded-md bg-white/6 px-3 py-1 text-sm text-white/70 w-full">
                  <svg
                    className="h-3 w-3 text-white/50"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                  </svg>
                  <span className="truncate">localhost:3000</span>
                </div>

                {/* AI status */}
                <div className="flex items-center gap-2">
                  <div className="text-xs text-white/50">AI:</div>
                  <div className="rounded-full bg-linear-to-r from-indigo-600 to-violet-500 px-3 py-1 text-xs font-medium text-white shadow-sm">
                    Building...
                  </div>
                </div>
              </div>
            </div>

            {/* Device icons */}
            <div className="ml-3 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md bg-white/3 px-2 py-1 text-sm text-white/70">
                <button
                  onClick={() => setPreviewDevice("desktop")}
                  className="p-1 hover:bg-white/4 rounded-md"
                >
                  <Monitor className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice("tablet")}
                  className="p-1 hover:bg-white/4 rounded-md"
                >
                  <Tablet className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPreviewDevice("mobile")}
                  className="p-1 hover:bg-white/4 rounded-md"
                >
                  <Smartphone className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full rounded-full bg-white/6">
            <div
              className="h-2 rounded-full bg-linear-to-r from-indigo-500 to-violet-400 transition-all"
              style={{ width: `${buildProgress}%` }}
            />
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
                      <button
                        className={`px-3 py-1 rounded-md text-xs ${previewDevice === "desktop" ? "bg-white/5 text-white" : "text-white/50"}`}
                      >
                        Desktop
                      </button>
                      <button
                        className={`px-3 py-1 rounded-md text-xs ${previewDevice === "tablet" ? "bg-white/5 text-white" : "text-white/50"}`}
                      >
                        Tablet
                      </button>
                      <button
                        className={`px-3 py-1 rounded-md text-xs ${previewDevice === "mobile" ? "bg-white/5 text-white" : "text-white/50"}`}
                      >
                        Mobile
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs text-white/40">Preview URL</div>
                    <div className="text-xs text-white/60">
                      preview.appbuilder.ai
                    </div>
                  </div>
                </div>

                <div className="flex h-85 items-stretch justify-center p-6">
                  <div className="w-full max-w-full rounded-md border border-white/6 bg-[#0b0b0b] p-6 text-white/60">
                    <div className="animate-pulse text-sm">
                      Rendering app preview skeleton…
                    </div>
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
                  <div className="rounded-full bg-linear-to-r from-indigo-600 to-violet-500 p-2 text-white shadow">
                    AI
                  </div>
                  <div className="text-sm font-semibold text-white">
                    AI Assistant
                  </div>
                </div>
                <div className="text-xs text-white/40">Live</div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs text-white/40">Current task</div>
                  <div className="mt-1 rounded-md bg-white/6 px-3 py-2 text-sm text-white/80">
                    Building application preview
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/40">Generated files</div>
                    <div className="text-xs text-white/50">3 files</div>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-white/60">
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-white/40" /> src/App.tsx
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-white/40" />{" "}
                      components/Header.tsx
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-white/40" />{" "}
                      styles/app.css
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="text-xs text-white/40">Build logs</div>
                  <div className="mt-2 rounded-md bg-[#050505] p-2 text-xs text-white/50">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4" />{" "}
                      <span>Installing dependencies…</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Activity className="h-4 w-4" />{" "}
                      <span>Compiling modules</span>
                    </div>
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
                  <div className="rounded-full bg-white/6 px-2 py-1 text-xs text-white/80">
                    Building
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Footer: deployment status chips */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <div className="rounded-full bg-white/6 px-3 py-1 text-xs">
                Building
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-xs">
                Testing
              </div>
              <div className="rounded-full bg-emerald-600/80 px-3 py-1 text-xs text-white">
                Ready
              </div>
              <div className="rounded-full bg-indigo-600 px-3 py-1 text-xs text-white">
                Deployed
              </div>
            </div>

            <div className="text-sm text-white/40">Last updated 2m ago</div>
          </div>
        </div>
      </section>
  )
}
