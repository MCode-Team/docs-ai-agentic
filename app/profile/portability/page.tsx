"use client";

import { useState } from "react";

export default function PortabilityPage() {
  const [status, setStatus] = useState<string>("");
  const [exportText, setExportText] = useState<string>("");
  const [importText, setImportText] = useState<string>("");

  async function doExport() {
    setStatus("Exporting...");
    const res = await fetch("/api/profile/export?dailyDays=30&factsLimit=100", { cache: "no-store" });
    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "failed"}`);
      return;
    }
    setExportText(JSON.stringify(data.export, null, 2));
    setStatus("Export ready");
  }

  async function doImport() {
    setStatus("Importing...");
    let parsed: any;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setStatus("Invalid JSON");
      return;
    }

    const res = await fetch("/api/profile/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "failed"}`);
      return;
    }
    setStatus("Imported");
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setStatus("Copied export JSON");
    } catch {
      setStatus("Copy failed");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Portability</h1>
          <div className="text-xs text-gray-500">Export/Import your OpenClaw-style profile (core files + daily + facts).</div>
        </div>
        <div className="flex items-center gap-2">
          <a className="text-sm text-blue-600 hover:underline" href="/profile">Profile</a>
          <a className="text-sm text-blue-600 hover:underline" href="/docs/getting-started">Back to Docs</a>
        </div>
      </div>

      <div className="text-xs text-gray-500">{status || "Ready"}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="text-sm font-medium">Export</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50" onClick={doExport}>Generate</button>
              <button className="px-3 py-1.5 text-sm rounded bg-black text-white disabled:opacity-50" onClick={copyExport} disabled={!exportText}>Copy</button>
            </div>
          </div>
          <textarea className="w-full min-h-[420px] p-3 text-xs font-mono" value={exportText} readOnly placeholder="Export JSON will appear here" />
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="text-sm font-medium">Import</div>
            <button className="px-3 py-1.5 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700" onClick={doImport}>
              Import
            </button>
          </div>
          <textarea
            className="w-full min-h-[420px] p-3 text-xs font-mono"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste export JSON here to import"
          />
        </div>
      </div>
    </div>
  );
}
