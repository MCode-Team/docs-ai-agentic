
import { tool } from "ai";
import { z } from "zod";
import { db } from "../../db";

export const getOrdersTool = tool({
    description: "ดึงข้อมูลรายการออเดอร์ (Raw Rows) ตามช่วงวันที่ เพื่อนำไปวิเคราะห์ต่อ (เช่น Monthly breakdown, Top N, MoM)",
    parameters: z.object({
        dateFrom: z.string().describe("Start date (YYYY-MM-DD)"),
        dateTo: z.string().describe("End date (YYYY-MM-DD)"),
        limit: z.number().optional().default(1000).describe("Max rows to fetch"),
    }),
    execute: async ({ dateFrom, dateTo, limit }: { dateFrom: string; dateTo: string; limit: number }) => {
        const safeLimit = limit ?? 100;
        const rows = await db`
      SELECT id, order_code, order_status, order_amount::float, created_at
      FROM sale_order.orders
      WHERE created_at::date BETWEEN ${dateFrom} AND ${dateTo}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;
        return rows as unknown as any[];
    },
} as any);
