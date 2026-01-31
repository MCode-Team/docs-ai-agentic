import { tool } from "ai";
import { z } from "zod";
import { queryAggregateTool } from "./query-aggregate";

export const trendReportTool = tool({
  description:
    "Generate a trend time series from sales_lines (Bangkok timezone) with optional grouping (sku/branch/category).",
  parameters: z.object({
    dateFrom: z.string().describe("YYYY-MM-DD"),
    dateTo: z.string().describe("YYYY-MM-DD"),
    grain: z.enum(["day", "week", "month"]).default("day"),
    groupBy: z.array(z.enum(["sku", "branch_id", "category_id"]))
      .default([])
      .describe("Optional extra grouping"),
    metric: z.enum(["qty", "net_sales", "gross_profit"]).default("net_sales"),
    limit: z.number().int().min(1).max(5000).default(500),
  }),
  execute: async (input) => {
    const dateField = input.grain === "day" ? "date_day" : input.grain === "week" ? "date_week" : "date_month";

    const res = await (queryAggregateTool as any).execute({
      dataset: "sales_lines",
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      groupBy: [dateField, ...input.groupBy],
      metrics: [input.metric],
      limit: input.limit,
      orderBy: { field: dateField, direction: "asc" },
    });

    return { ok: true, ...res };
  },
} as any);
