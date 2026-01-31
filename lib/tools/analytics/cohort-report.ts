import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";

export const cohortReportTool = tool({
  description:
    "Cohort analysis by customer first purchase month (Bangkok). Returns retention-style matrix (customers + revenue per month index).",
  parameters: z.object({
    dateFrom: z.string().describe("YYYY-MM-DD"),
    dateTo: z.string().describe("YYYY-MM-DD"),
    maxMonths: z.number().int().min(1).max(24).default(12),
    branchIds: z.array(z.string()).optional(),
  }),
  execute: async ({ dateFrom, dateTo, maxMonths, branchIds }) => {
    const params: any[] = [dateFrom, dateTo, maxMonths];
    const where: string[] = [
      "(o.order_datetime AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1 AND $2",
      "o.customer_id IS NOT NULL",
    ];
    if (branchIds && branchIds.length) {
      where.push(`o.branch_id = ANY($${params.length + 1})`);
      params.push(branchIds);
    }

    const sql = `
      WITH orders_local AS (
        SELECT
          o.customer_id,
          o.branch_id,
          date_trunc('month', (o.order_datetime AT TIME ZONE 'Asia/Bangkok')) AS order_month,
          o.net_amount::numeric AS net_amount
        FROM analytics.orders o
        WHERE ${where.join(" AND ")}
      ), firsts AS (
        SELECT
          customer_id,
          MIN(order_month) AS cohort_month
        FROM orders_local
        GROUP BY customer_id
      ), joined AS (
        SELECT
          ol.customer_id,
          f.cohort_month,
          ol.order_month,
          (EXTRACT(YEAR FROM ol.order_month) - EXTRACT(YEAR FROM f.cohort_month)) * 12
            + (EXTRACT(MONTH FROM ol.order_month) - EXTRACT(MONTH FROM f.cohort_month)) AS month_index,
          ol.net_amount
        FROM orders_local ol
        JOIN firsts f USING (customer_id)
      )
      SELECT
        cohort_month,
        month_index::int,
        COUNT(DISTINCT customer_id) AS customers,
        SUM(net_amount)::float AS revenue
      FROM joined
      WHERE month_index BETWEEN 0 AND $3
      GROUP BY cohort_month, month_index
      ORDER BY cohort_month ASC, month_index ASC
    `;

    const rows = await db.unsafe(sql, params);
    return { ok: true, rowCount: rows.length, rows };
  },
} as any);
