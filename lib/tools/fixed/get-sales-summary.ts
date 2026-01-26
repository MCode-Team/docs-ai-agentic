import { tool } from "ai";
import { z } from "zod";
import { db } from "../../db";

export const getSalesSummaryTool = tool({
  description: "สรุปยอดขายตามช่วงวันที่ (จำนวนออเดอร์ + ยอดขายรวม)",
  parameters: z.object({
    dateFrom: z.string(),
    dateTo: z.string(),
  }),
  execute: async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    const rows = await db`
      SELECT
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(order_amount),0)::float AS total_sales
      FROM sale_order.orders
      WHERE created_at::date BETWEEN ${dateFrom} AND ${dateTo}
    `;
    return rows[0] as unknown as any;
  },
} as any);
