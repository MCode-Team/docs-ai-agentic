import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";

export const oosReportTool = tool({
  description:
    "Find branches/SKUs that sold in a period but have zero or missing real-time stock. Designed for inventory gap analysis.",
  parameters: z.object({
    dateFrom: z.string().describe("YYYY-MM-DD"),
    dateTo: z.string().describe("YYYY-MM-DD"),
    topN: z.number().int().min(1).max(500).default(50),
    branchIds: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
  }),
  execute: async ({ dateFrom, dateTo, topN, branchIds, categoryIds }) => {
    const params: any[] = [dateFrom, dateTo, topN];

    // Bangkok date filter
    const where: string[] = [
      "(sl.order_datetime AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2",
    ];

    if (branchIds && branchIds.length) {
      where.push(`sl.branch_id = ANY($${params.length + 1})`);
      params.push(branchIds);
    }
    if (categoryIds && categoryIds.length) {
      where.push(`p.category_id = ANY($${params.length + 1})`);
      params.push(categoryIds);
    }

    const sql = `
      WITH sales AS (
        SELECT
          sl.branch_id,
          sl.sku,
          SUM(sl.qty) AS qty,
          SUM(sl.net_sales) AS net_sales,
          SUM(sl.cost) AS cost,
          SUM(sl.net_sales - sl.cost) AS gross_profit
        FROM analytics.sales_lines sl
        LEFT JOIN analytics.products p ON p.sku = sl.sku
        WHERE ${where.join(" AND ")}
        GROUP BY sl.branch_id, sl.sku
      ), ranked AS (
        SELECT *
        FROM sales
        ORDER BY net_sales DESC
        LIMIT $3
      )
      SELECT
        r.branch_id,
        b.branch_name,
        b.province,
        r.sku,
        p.product_name,
        p.brand_name,
        p.category_id,
        c.category_name,
        r.qty::float,
        r.net_sales::float,
        r.cost::float,
        r.gross_profit::float,
        COALESCE(inv.on_hand_qty, 0)::float AS on_hand_qty,
        inv.updated_at AS stock_updated_at,
        CASE
          WHEN inv.on_hand_qty IS NULL THEN 'NO_RECORD'
          WHEN inv.on_hand_qty <= 0 THEN 'OOS'
          ELSE 'OK'
        END AS stock_status
      FROM ranked r
      LEFT JOIN analytics.inventory_current inv
        ON inv.branch_id = r.branch_id AND inv.sku = r.sku
      LEFT JOIN analytics.branches b ON b.branch_id = r.branch_id
      LEFT JOIN analytics.products p ON p.sku = r.sku
      LEFT JOIN analytics.product_categories c ON c.category_id = p.category_id
      WHERE (inv.on_hand_qty IS NULL OR inv.on_hand_qty <= 0)
      ORDER BY r.net_sales DESC
    `;

    const rows = await db.unsafe(sql, params);
    return { ok: true, rowCount: rows.length, rows };
  },
} as any);
