import { describe, expect, it } from "vitest";
import { queryAggregateTool } from "../lib/tools/analytics/query-aggregate";

// Integration-style test (requires DATABASE_URL + seeded schema).

describe("queryAggregateTool", () => {
  it.skipIf(!process.env.DATABASE_URL)("runs a simple aggregate", async () => {
    const res = await (queryAggregateTool as any).execute({
      dataset: "sales_lines",
      dateFrom: "2025-01-01",
      dateTo: "2026-12-31",
      groupBy: ["sku"],
      metrics: ["net_sales", "gross_profit"],
      limit: 5,
      orderBy: { field: "net_sales", direction: "desc" },
    });
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.rows)).toBe(true);
  });
});
