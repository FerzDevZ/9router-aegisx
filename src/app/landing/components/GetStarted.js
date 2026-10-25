"use client";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function GetStarted() {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = (text) => {
    copy(text, "landing");
  };

  return (
    <section className="py-24 px-6 bg-[#120f0d]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left: Steps */}
          <div className="flex-1">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Get Started in 3 Steps</h2>
            <p className="text-gray-400 text-lg mb-8">
              Install 9Router AegisX, configure your providers via web dashboard, and start routing AI requests.
            </p>

            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <div className="flex-none w-8 h-8 rounded-full bg-[#f97815]/20 text-[#f97815] flex items-center justify-center font-bold">1</div>
                <div>
                  <h4 className="font-bold text-lg">Install AegisX</h4>
                  <p className="text-sm text-gray-500 mt-1">Clone the repo, install deps, build (Node.js ≥ 22)</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-none w-8 h-8 rounded-full bg-[#f97815]/20 text-[#f97815] flex items-center justify-center font-bold">2</div>
                <div>
                  <h4 className="font-bold text-lg">Start &amp; Open Dashboard</h4>
                  <p className="text-sm text-gray-500 mt-1">The first-run password is printed to the console</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-none w-8 h-8 rounded-full bg-[#f97815]/20 text-[#f97815] flex items-center justify-center font-bold">3</div>
                <div>
                  <h4 className="font-bold text-lg">Route Requests</h4>
                  <p className="text-sm text-gray-500 mt-1">Point your CLI tools to http://localhost:20128</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 mt-8 border-t border-[#3a2f27] pt-4">
              AegisX installs from source. The npm package <code className="text-gray-400">9router</code> is the
              upstream project — it does not include the AegisX hardening.
            </p>
          </div>

          {/* Right: Code block */}
          <div className="flex-1 w-full">
            <div className="rounded-xl overflow-hidden bg-[#1e1e1e] border border-[#3a2f27] shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#252526] border-b border-gray-700">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div className="ml-2 text-xs text-gray-500 font-mono">terminal</div>
              </div>

              {/* Terminal content */}
              <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
                <div
                  className="flex items-center gap-2 mb-2 group cursor-pointer"
                  onClick={() => handleCopy("git clone https://github.com/FerzDevZ/9router-aegisx.git")}
                >
                  <span className="text-green-400">$</span>
                  <span className="text-white">git clone https://github.com/FerzDevZ/9router-aegisx.git</span>
                  <span className="ml-auto text-gray-500 text-xs opacity-0 group-hover:opacity-100">
                    {copied === "landing" ? "✓ Copied" : "Copy"}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 mb-2 group cursor-pointer"
                  onClick={() => handleCopy("cd 9router-aegisx && npm install && npm run build")}
                >
                  <span className="text-green-400">$</span>
                  <span className="text-white">cd 9router-aegisx &amp;&amp; npm install &amp;&amp; npm run build</span>
                </div>

                <div
                  className="flex items-center gap-2 mb-4 group cursor-pointer"
                  onClick={() => handleCopy("npm start -- --port 20128")}
                >
                  <span className="text-green-400">$</span>
                  <span className="text-white">npm start -- --port 20128</span>
                </div>

                <div className="text-gray-400 mb-6">
                  <span className="text-[#f97815]">&gt;</span> Server running on <span className="text-blue-400">http://localhost:20128</span><br/>
                  <span className="text-[#f97815]">&gt;</span> Dashboard: <span className="text-blue-400">http://localhost:20128/dashboard</span><br/>
                  <span className="text-green-400">&gt;</span> Ready to route! ✓
                </div>

                <div className="text-xs text-gray-500 mb-2 border-t border-gray-700 pt-4">
                  📝 First-run password prints to the console — set a permanent one in the dashboard
                </div>

                <div className="text-gray-400 text-xs">
                  <span className="text-purple-400">Data Location:</span><br/>
                  <span className="text-gray-500">  macOS/Linux:</span> ~/.9router/db/data.sqlite<br/>
                  <span className="text-gray-500">  Windows:</span> %APPDATA%/9router/db/data.sqlite
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
