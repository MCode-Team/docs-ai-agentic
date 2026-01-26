import { getSalesSummaryTool } from "@/lib/tools/fixed/get-sales-summary";
import { getOrderStatusCountsTool } from "@/lib/tools/fixed/get-order-status-counts";
import { analyzeDataTool } from "@/lib/tools/analyze/analyze-data";
import { exportExcelDynamicTool } from "@/lib/tools/export/export-excel-dynamic";

export const toolRegistry = {
  getSalesSummary: getSalesSummaryTool,
  getOrderStatusCounts: getOrderStatusCountsTool,
  analyzeData: analyzeDataTool,
  exportExcelDynamic: exportExcelDynamicTool,
} as const;

export type ToolName = keyof typeof toolRegistry;
