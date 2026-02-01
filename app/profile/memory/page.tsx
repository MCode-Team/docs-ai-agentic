"use client";

import { useMemo, useState } from "react";

export default function MemoryToolsPage() {
  const [days, setDays] = useState(3);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const body = useMemo(() => ({ days }), [days]);

  async function runMaintenance() {
    setStatus("Running memory maintenance...");
    setResult(null);
    const res = await fetch("/api/profile/memory/maintain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "failed"}`);
      return;
    }
    setResult(data);
    setStatus("Done. MEMORY.md updated.");
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Memory Tools</h1>
          <div className="text-xs text-gray-500">Summarize recent daily logs into MEMORY.md (OpenClaw-style maintenance).</div>
        </div>
        <div className="flex items-center gap-2">
          <a className="text-sm text-blue-600 hover:underline" href="/profile">Profile</a>
          <a className="text-sm text-blue-600 hover:underline" href="/docs/getting-started">Back to Docs</a>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="font-medium">Update MEMORY.md</div>
        <div className="text-xs text-gray-500">Uses the last N daily memory entries.</div>
        <div className="flex items-center gap-2">
          <span className="text-xs">Days</span>
          <input className="border rounded px-2 py-1 w-24" type="number" value={days} min={1} max={14} onChange={(e) => setDays(Number(e.target.value))} />
          <button className="px-3 py-2 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700" onClick={runMaintenance}>
            Run
          </button>
          <div className="text-xs text-gray-500 ml-auto">{status || "Ready"}</div>
        </div>
      </div>

      {result && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="font-medium mb-2">Result</div>
          <pre className="text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
