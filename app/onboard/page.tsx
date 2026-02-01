"use client";

import { useEffect, useMemo, useState } from "react";

export default function OnboardPage() {
  const [lang, setLang] = useState<"th" | "en">("th");
  const [prompt, setPrompt] = useState<string>("");
  const [jsonText, setJsonText] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<any>(null);

  const example = useMemo(
    () =>
      `{"version":"1","identity":{"name":"...","role":"...","tone":"..."},"user":{"displayName":"...","timezone":"Asia/Bangkok","projects":["..."],"goals":["..."]},"soul":{"principles":["..."],"boundaries":["..."]},"facts":[{"type":"context","facts":["..."],"importance":0.8}]}`,
    []
  );

  async function loadPrompt(nextLang: "th" | "en") {
    setStatus("Loading prompt...");
    const res = await fetch(`/api/bootstrap?lang=${nextLang}`, { cache: "no-store" });
    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "Failed to load"}`);
      return;
    }
    setPrompt(data.prompt || "");
    setStatus("Ready");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("Copied prompt to clipboard");
    } catch {
      setStatus("Copy failed (browser permission) — you can still select and copy manually");
    }
  }

  async function importJson() {
    setStatus("Importing...");
    setResult(null);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setStatus("Invalid JSON — paste the raw JSON from your existing AI");
      return;
    }

    const res = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "Import failed"}`);
      return;
    }

    setResult(data);
    setStatus("Imported successfully — go to /profile to review core files");
  }

  useEffect(() => {
    loadPrompt(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Onboard in 5 seconds</h1>
          <div className="text-xs text-gray-500">
            Copy the trigger prompt → paste into your existing AI → paste returned JSON here to import.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a className="text-sm text-blue-600 hover:underline" href="/profile">Profile</a>
          <a className="text-sm text-blue-600 hover:underline" href="/docs/getting-started">Back to Docs</a>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Language</span>
        <select className="border rounded px-2 py-1 text-sm" value={lang} onChange={(e) => setLang(e.target.value as any)}>
          <option value="th">ไทย</option>
          <option value="en">English</option>
        </select>
        <button className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50" onClick={() => loadPrompt(lang)}>
          Refresh
        </button>
        <div className="text-xs text-gray-500 ml-auto">{status || "Ready"}</div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-medium">Trigger Prompt</div>
          <button className="px-3 py-1.5 text-sm rounded bg-black text-white" onClick={copyPrompt} disabled={!prompt}>
            Copy
          </button>
        </div>
        <pre className="text-xs p-4 overflow-auto whitespace-pre-wrap">{prompt || "(loading...)"}</pre>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-medium">Paste JSON output</div>
          <div className="text-xs text-gray-500">Must be strict JSON only. Example:</div>
          <div className="text-[11px] font-mono text-gray-500 break-all">{example}</div>
        </div>
        <textarea
          className="w-full min-h-[260px] p-4 text-sm font-mono outline-none"
          placeholder="Paste JSON here"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200">
          <button className="px-3 py-2 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700" onClick={importJson}>
            Import
          </button>
        </div>
      </div>

      {result && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="font-medium mb-2">Import Result</div>
          <pre className="text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
