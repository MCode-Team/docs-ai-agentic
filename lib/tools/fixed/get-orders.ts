
import { tool } from "ai";
import { z } from "zod";
import { db } from "../../db";

export const getOrdersTool = tool({
    description: "ดึงข้อมูลรายการออเดอร์ (Raw Rows) ตามช่วงวันที่และสถานะ เพื่อนำไปวิเคราะห์ต่อ (เช่น Monthly breakdown, Top N, MoM)",
    parameters: z.object({
        dateFrom: z.string().describe("Start date (YYYY-MM-DD)"),
        dateTo: z.string().describe("End date (YYYY-MM-DD)"),
        status: z.number().optional().describe("Order status to filter (1=Pending, 2=Paid, 3=Shipped, 4=Completed, 5=Cancelled). Leave empty for all statuses."),
        limit: z.number().optional().default(1000).describe("Max rows to fetch"),
    }),
    execute: async ({ dateFrom, dateTo, status, limit }: { dateFrom: string; dateTo: string; status?: number; limit: number }) => {
        const safeLimit = limit ?? 100;
        let rows;

        if (status !== undefined) {
            rows = await db`
                SELECT id, order_code, order_status, order_amount::float, created_at
                FROM sale_order.orders
                WHERE created_at::date BETWEEN ${dateFrom} AND ${dateTo}
                AND order_status = ${status}
                ORDER BY order_amount DESC
                LIMIT ${safeLimit}
            `;
        } else {
            rows = await db`
                SELECT id, order_code, order_status, order_amount::float, created_at
                FROM sale_order.orders
                WHERE created_at::date BETWEEN ${dateFrom} AND ${dateTo}
                ORDER BY order_amount DESC
                LIMIT ${safeLimit}
            `;
        }

        // Convert postgres Result to plain array (postgres.js Result is array-like but fails Array.isArray)
        return [...rows];
    },
} as any);
