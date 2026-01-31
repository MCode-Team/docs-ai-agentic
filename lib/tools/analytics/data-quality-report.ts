import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";

export const dataQualityReportTool = tool({
  description:
    "Run basic data quality checks for analytics tables (sales, inventory freshness, negative values). Returns a compact report.",
  parameters: z.object({
    days: z.number().int().min(1).max(90).default(30),
  }),
  execute: async ({ days }) => {
    const rows = await db.unsafe(
      `
      WITH params AS (
        SELECT now() - ($1::int || ' days')::interval AS since
      )
      SELECT
        (SELECT COUNT(*) FROM analytics.orders o, params p WHERE o.order_datetime >= p.since) AS orders_last_n_days,
        (SELECT COUNT(*) FROM analytics.sales_lines sl, params p WHERE sl.order_datetime >= p.since) AS sales_lines_last_n_days,
        (SELECT COUNT(*) FROM analytics.sales_lines sl, params p WHERE sl.order_datetime >= p.since AND sl.net_sales < 0) AS negative_sales_rows,
        (SELECT COUNT(*) FROM analytics.sales_lines sl, params p WHERE sl.order_datetime >= p.since AND sl.cost < 0) AS negative_cost_rows,
        (SELECT COUNT(*) FROM analytics.sales_lines sl, params p WHERE sl.order_datetime >= p.since AND sl.cost > sl.net_sales) AS cost_gt_sales_rows,
        (SELECT COUNT(*) FROM analytics.inventory_current inv WHERE inv.updated_at < now() - interval '6 hours') AS stale_inventory_rows,
        (SELECT MAX(inv.updated_at) FROM analytics.inventory_current inv) AS inventory_last_update
      `,
      [days]
    );

    return { ok: true, days, report: rows?.[0] || null };
  },
} as any);
