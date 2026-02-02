import { tool } from "ai";
import { z } from "zod";
import { db } from "../../db";

export const getOrderStatusCountsTool = tool({
    description: "นับจำนวนออเดอร์แยกตามสถานะ ตามช่วงวันที่",
    parameters: z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
    }),
    execute: async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
        const rows = await db`
      SELECT order_status, COUNT(*)::int AS total
      FROM sale_order.orders
      WHERE created_at::date BETWEEN ${dateFrom} AND ${dateTo}
      GROUP BY order_status
      ORDER BY total DESC
    `;
        // Convert postgres Result to plain array
        return [...rows];
    },
} as any);
