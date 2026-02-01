"use client";

import { useEffect, useMemo, useState } from "react";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

type DailyRow = {
  id: number;
  userId: string;
  day: string;
  content: string;
  updatedAt: string;
};

export default function DailyMemoryPage() {
  const today = useMemo(() => new Date(), []);
  const [day, setDay] = useState(isoDate(today));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [row, setRow] = useState<DailyRow | null>(null);
  const [draft, setDraft] = useState<string>("");

  async function load(d: string) {
    setLoading(true);
    setStatus("Loading...");
    const res = await fetch(`/api/profile/daily?day=${encodeURIComponent(d)}`, { cache: "no-store" });
    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "failed"}`);
      setLoading(false);
      return;
    }
    const r = data.day as DailyRow;
    setRow(r);
    setDraft(r.content || "");
    setStatus("Ready");
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    setStatus("Saving...");
    const res = await fetch(`/api/profile/daily?day=${encodeURIComponent(day)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    const data = await res.json();
    if (!data?.ok) {
      setStatus(`Error: ${data?.error || "failed"}`);
      setSaving(false);
      return;
    }
    setRow(data.day as DailyRow);
    setStatus("Saved");
    setSaving(false);
  }

  useEffect(() => {
    load(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Daily Memory</h1>
          <div className="text-xs text-gray-500">Equivalent to OpenClaw memory/YYYY-MM-DD.md (per-user, DB-backed).</div>
        </div>
        <div className="flex items-center gap-2">
          <a className="text-sm text-blue-600 hover:underline" href="/profile">Profile</a>
          <a className="text-sm text-blue-600 hover:underline" href="/profile/memory">Memory Tools</a>
          <a className="text-sm text-blue-600 hover:underline" href="/docs/getting-started">Back to Docs</a>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Day</span>
        <input className="border rounded px-2 py-1" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <button className="px-3 py-1.5 text-sm rounded border border-gray-200 hover:bg-gray-50" onClick={() => load(day)} disabled={loading || saving}>
          Load
        </button>
        <div className="text-xs text-gray-500 ml-auto">{status || "Ready"}</div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-medium">memory/{day}.md</div>
          <div className="text-xs text-gray-500">{row ? `updated ${row.updatedAt}` : ""}</div>
        </div>

        <textarea
          className="w-full min-h-[420px] p-4 text-sm font-mono outline-none"
          placeholder="Write daily notes..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={loading}
        />

        <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200">
          <button
            className="px-3 py-2 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={save}
            disabled={loading || saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
