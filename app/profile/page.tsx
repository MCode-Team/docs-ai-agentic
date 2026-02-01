"use client";

import { useEffect, useMemo, useState } from "react";

type CoreFileKey = "IDENTITY" | "USER" | "SOUL" | "MEMORY";

type CoreFile = {
  id: number;
  userId: string;
  fileKey: CoreFileKey;
  content: string;
  version: number;
  updatedAt: string;
};

export default function ProfilePage() {
  const keys: CoreFileKey[] = useMemo(() => ["IDENTITY", "USER", "SOUL", "MEMORY"], []);
  const [active, setActive] = useState<CoreFileKey>("IDENTITY");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [files, setFiles] = useState<Record<CoreFileKey, CoreFile> | null>(null);
  const [draft, setDraft] = useState<Record<CoreFileKey, string>>({
    IDENTITY: "",
    USER: "",
    SOUL: "",
    MEMORY: "",
  });

  async function load() {
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/profile/core-files", { cache: "no-store" });
    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "Failed to load"}`);
      setLoading(false);
      return;
    }
    const core = data.coreFiles as Record<CoreFileKey, CoreFile>;
    setFiles(core);
    setDraft({
      IDENTITY: core.IDENTITY?.content ?? "",
      USER: core.USER?.content ?? "",
      SOUL: core.SOUL?.content ?? "",
      MEMORY: core.MEMORY?.content ?? "",
    });
    setLoading(false);
  }

  async function saveCurrent() {
    if (!files) return;
    setSaving(true);
    setStatus("Saving...");

    const current = files[active];
    const res = await fetch(`/api/profile/core-files/${active}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: draft[active],
        expectedVersion: current.version,
      }),
    });

    const data = await res.json();
    if (!data?.ok) {
      if (data?.error === "VERSION_CONFLICT") {
        setStatus("Version conflict: someone/something updated this file. Reloading...");
        await load();
      } else {
        setStatus(`Error: ${data?.error || "Save failed"}`);
      }
      setSaving(false);
      return;
    }

    const updated = data.file as CoreFile;
    setFiles({ ...files, [active]: updated });
    setStatus("Saved");
    setSaving(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Profile (OpenClaw-style)</h1>
          <div className="text-xs text-gray-500">
            These are your core files: IDENTITY / USER / SOUL / MEMORY. The agent reads them every turn.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a className="text-sm text-blue-600 hover:underline" href="/onboard">Onboard in 5 seconds</a>
          <a className="text-sm text-blue-600 hover:underline" href="/profile/daily">Daily memory</a>
          <a className="text-sm text-blue-600 hover:underline" href="/profile/memory">Memory tools</a>
          <a className="text-sm text-blue-600 hover:underline" href="/profile/portability">Export/Import</a>
          <a className="text-sm text-blue-600 hover:underline" href="/docs/getting-started">Back to Docs</a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {keys.map((k) => (
          <button
            key={k}
            className={`px-3 py-1.5 text-sm rounded border ${active === k ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50 border-gray-200"}`}
            onClick={() => setActive(k)}
          >
            {k}.md
          </button>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-medium">{active}.md</div>
          <div className="text-xs text-gray-500">{files ? `v${files[active].version}` : ""}</div>
        </div>

        <textarea
          className="w-full min-h-[420px] p-4 text-sm font-mono outline-none"
          placeholder={`Write ${active}.md...`}
          value={draft[active]}
          onChange={(e) => setDraft({ ...draft, [active]: e.target.value })}
          disabled={loading}
        />

        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
          <div className="text-xs text-gray-500">{loading ? "Loading..." : status || "Ready"}</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 text-sm rounded border border-gray-200 hover:bg-gray-50"
              onClick={load}
              disabled={loading || saving}
            >
              Reload
            </button>
            <button
              className="px-3 py-2 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={saveCurrent}
              disabled={loading || saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Tip: Put your non-negotiable rules in <span className="font-mono">SOUL.md</span>. Put long-term stable context in <span className="font-mono">MEMORY.md</span>.
      </div>
    </div>
  );
}
