"use client";

import { useEffect, useMemo, useState } from "react";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function DemoDashboard() {
  const today = useMemo(() => new Date(), []);
  const [dateTo, setDateTo] = useState(isoDate(today));
  const [dateFrom, setDateFrom] = useState(isoDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)));

  const [topN, setTopN] = useState(50);
  const [maxMonths, setMaxMonths] = useState(12);
  const [status, setStatus] = useState<string>("");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [dq, setDq] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  async function run(endpoint: string, body: any) {
    setStatus("Running...");
    setLastLink(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data?.ok && data.downloadUrl) {
      setLastLink(data.downloadUrl);
      setStatus(`Done: ${data.filename} (expires ${data.expiresAt})`);
    } else if (data?.ok) {
      setStatus("Done");
      if (endpoint.includes("data-quality")) setDq(data);
      if (endpoint.includes("/summary")) setSummary(data.summary);
    } else {
      setStatus(`Error: ${data?.error || "unknown"}`);
    }
  }

  useEffect(() => {
    // initial data quality + summary
    run("/api/reports/data-quality", { days: 30 });
    run("/api/reports/summary", { dateFrom, dateTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refresh summary when date range changes
    run("/api/reports/summary", { dateFrom, dateTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Demo Dashboard</h1>
        <a className="text-sm text-blue-600 hover:underline" href="/docs/downloads">
          Downloads
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-gray-200 rounded-lg p-3 md:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="bg-gray-50 border border-gray-100 rounded p-2">
              <div className="text-[11px] text-gray-500">Orders</div>
              <div className="text-sm font-semibold">{summary?.order_count?.toLocaleString?.() ?? "-"}</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded p-2">
              <div className="text-[11px] text-gray-500">Customers</div>
              <div className="text-sm font-semibold">{summary?.customer_count?.toLocaleString?.() ?? "-"}</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded p-2">
              <div className="text-[11px] text-gray-500">Net Sales</div>
              <div className="text-sm font-semibold">{summary?.net_sales?.toLocaleString?.() ?? "-"}</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded p-2">
              <div className="text-[11px] text-gray-500">Cost</div>
              <div className="text-sm font-semibold">{summary?.cost?.toLocaleString?.() ?? "-"}</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded p-2">
              <div className="text-[11px] text-gray-500">Gross Profit</div>
              <div className="text-sm font-semibold">{summary?.gross_profit?.toLocaleString?.() ?? "-"}</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded p-2">
              <div className="text-[11px] text-gray-500">GP%</div>
              <div className="text-sm font-semibold">{summary?.gp_margin != null ? `${(summary.gp_margin * 100).toFixed(1)}%` : "-"}</div>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-2">Date From</div>
          <input className="border rounded px-2 py-1 w-full" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-2">Date To</div>
          <input className="border rounded px-2 py-1 w-full" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-2">Status</div>
          <div className="text-sm break-all">{status || "Ready"}</div>
          {lastLink && (
            <a className="text-sm text-blue-600 hover:underline" href={lastLink}>
              Download latest file
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="font-medium">Top SKU Report</div>
          <div className="text-xs text-gray-500">Creates multi-sheet workbook</div>
          <div className="flex items-center gap-2">
            <span className="text-xs">TopN</span>
            <input className="border rounded px-2 py-1 w-24" type="number" value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
          </div>
          <button
            className="px-3 py-2 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700"
            onClick={() => run("/api/reports/top-sku", { dateFrom, dateTo, topN })}
          >
            Generate
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="font-medium">OOS Report</div>
          <div className="text-xs text-gray-500">Sold but stock is 0 / missing</div>
          <button
            className="px-3 py-2 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700"
            onClick={() => run("/api/reports/oos", { dateFrom, dateTo, topN: Math.min(200, topN) })}
          >
            Generate
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="font-medium">Cohort Report</div>
          <div className="text-xs text-gray-500">First purchase month cohorts</div>
          <div className="flex items-center gap-2">
            <span className="text-xs">Months</span>
            <input className="border rounded px-2 py-1 w-24" type="number" value={maxMonths} onChange={(e) => setMaxMonths(Number(e.target.value))} />
          </div>
          <button
            className="px-3 py-2 text-sm rounded bg-[#006cff] text-white hover:bg-blue-700"
            onClick={() => run("/api/reports/cohort", { dateFrom, dateTo, maxMonths })}
          >
            Generate
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <div className="font-medium mb-2">Data Quality (last 30 days)</div>
        <pre className="text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">
          {JSON.stringify(dq?.report || dq, null, 2)}
        </pre>
      </div>

      <div className="text-xs text-gray-500">
        Tip: ใช้ <span className="font-mono">npm run seed:analytics:reset</span> เพื่อสร้างข้อมูลเดโม แล้วเข้า <span className="font-mono">/demo</span>
      </div>
    </div>
  );
}
