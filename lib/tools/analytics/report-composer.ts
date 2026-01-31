import { tool } from "ai";
import { z } from "zod";
import { queryAggregateTool } from "./query-aggregate";
import { trendReportTool } from "./trend-report";
import { cohortReportTool } from "./cohort-report";
import { oosReportTool } from "./oos-report";
import { exportExcelArtifactTool } from "./export-excel-artifact";

/**
 * High-level report composer tools.
 * These wrap low-level analytics tools into standardized multi-sheet workbooks
 * to reduce planner complexity and improve consistency.
 */

const CommonFilters = z
  .object({
    branchIds: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
    skus: z.array(z.string()).optional(),
    channels: z.array(z.string()).optional(),
  })
  .optional();

export const buildTopSkuWorkbookTool = tool({
  description:
    "Build a multi-sheet Excel workbook for Top SKU analytics (qty/net_sales/gp) and return an expiring download URL.",
  parameters: z.object({
    userId: z.string(),
    conversationId: z.string().nullable().optional(),
    dateFrom: z.string().describe("YYYY-MM-DD"),
    dateTo: z.string().describe("YYYY-MM-DD"),
    topN: z.number().int().min(1).max(500).default(50),
    filters: CommonFilters,
  }),
  execute: async ({ userId, conversationId, dateFrom, dateTo, topN, filters }) => {
    const top = await (queryAggregateTool as any).execute({
      dataset: "sales_lines",
      dateFrom,
      dateTo,
      groupBy: ["sku"],
      metrics: ["qty", "net_sales", "cost", "gross_profit"],
      filters,
      limit: topN,
      orderBy: { field: "net_sales", direction: "desc" },
    });

    const trend = await (trendReportTool as any).execute({
      dateFrom,
      dateTo,
      grain: "week",
      groupBy: [],
      metric: "net_sales",
      limit: 1000,
    });

    const summary = await (queryAggregateTool as any).execute({
      dataset: "sales_lines",
      dateFrom,
      dateTo,
      groupBy: [],
      metrics: ["qty", "net_sales", "cost", "gross_profit"],
      filters,
      limit: 1,
      orderBy: { field: "net_sales", direction: "desc" },
    });

    const sheets = [
      {
        name: "README",
        rows: [
          {
            note: "Top SKU Workbook",
            dateFrom,
            dateTo,
            topN,
            generatedAt: new Date().toISOString(),
          },
        ],
      },
      {
        name: "Summary",
        rows: (summary?.rows || summary?.rows === 0 ? summary.rows : (summary?.rows as any)) ||
          (summary?.rows ?? summary?.rows) ||
          (summary?.rows ? summary.rows : (summary?.rows as any)) ||
          (summary?.rows ?? []),
      },
      {
        name: "TopSKU",
        rows: top.rows,
      },
      {
        name: "Trend_Weekly",
        rows: trend.rows,
      },
    ];

    const filename = `top-sku_${dateFrom}_${dateTo}.xlsx`;

    return await (exportExcelArtifactTool as any).execute({
      userId,
      conversationId: conversationId ?? null,
      filename,
      ttlHours: 24,
      sheets,
    });
  },
} as any);

export const buildOosWorkbookTool = tool({
  description:
    "Build a multi-sheet Excel workbook for OOS / inventory gap analysis and return an expiring download URL.",
  parameters: z.object({
    userId: z.string(),
    conversationId: z.string().nullable().optional(),
    dateFrom: z.string().describe("YYYY-MM-DD"),
    dateTo: z.string().describe("YYYY-MM-DD"),
    topN: z.number().int().min(1).max(500).default(100),
    branchIds: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
  }),
  execute: async ({ userId, conversationId, dateFrom, dateTo, topN, branchIds, categoryIds }) => {
    const oos = await (oosReportTool as any).execute({
      dateFrom,
      dateTo,
      topN,
      branchIds,
      categoryIds,
    });

    const sheets = [
      {
        name: "README",
        rows: [
          {
            note: "OOS Workbook",
            dateFrom,
            dateTo,
            topN,
            generatedAt: new Date().toISOString(),
          },
        ],
      },
      {
        name: "OOS",
        rows: oos.rows,
      },
    ];

    const filename = `oos_${dateFrom}_${dateTo}.xlsx`;
    return await (exportExcelArtifactTool as any).execute({
      userId,
      conversationId: conversationId ?? null,
      filename,
      ttlHours: 24,
      sheets,
    });
  },
} as any);

export const buildCohortWorkbookTool = tool({
  description:
    "Build a cohort Excel workbook (customers + revenue by cohort month_index) and return an expiring download URL.",
  parameters: z.object({
    userId: z.string(),
    conversationId: z.string().nullable().optional(),
    dateFrom: z.string().describe("YYYY-MM-DD"),
    dateTo: z.string().describe("YYYY-MM-DD"),
    maxMonths: z.number().int().min(1).max(24).default(12),
    branchIds: z.array(z.string()).optional(),
  }),
  execute: async ({ userId, conversationId, dateFrom, dateTo, maxMonths, branchIds }) => {
    const cohort = await (cohortReportTool as any).execute({
      dateFrom,
      dateTo,
      maxMonths,
      branchIds,
    });

    const sheets = [
      {
        name: "README",
        rows: [
          {
            note: "Cohort Workbook",
            dateFrom,
            dateTo,
            maxMonths,
            generatedAt: new Date().toISOString(),
          },
        ],
      },
      {
        name: "Cohort",
        rows: cohort.rows,
      },
    ];

    const filename = `cohort_${dateFrom}_${dateTo}.xlsx`;
    return await (exportExcelArtifactTool as any).execute({
      userId,
      conversationId: conversationId ?? null,
      filename,
      ttlHours: 24,
      sheets,
    });
  },
} as any);

export const reportComposerTools = {
  buildTopSkuWorkbook: buildTopSkuWorkbookTool,
  buildOosWorkbook: buildOosWorkbookTool,
  buildCohortWorkbook: buildCohortWorkbookTool,
};
