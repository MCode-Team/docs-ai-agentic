import { getSalesSummaryTool } from "@/lib/tools/fixed/get-sales-summary";
import { getOrderStatusCountsTool } from "@/lib/tools/fixed/get-order-status-counts";
import { analyzeDataTool } from "@/lib/tools/analyze/analyze-data";
import { exportExcelDynamicTool } from "@/lib/tools/export/export-excel-dynamic";
import { getOrdersTool } from "@/lib/tools/fixed/get-orders";
import { executeCodeTool } from "@/lib/tools/sandbox/execute-code";
import { bashTool, readFileTool, writeFileTool } from "@/lib/tools/sandbox/bash-tools";

export const toolRegistry = {
  getSalesSummary: getSalesSummaryTool,
  getOrderStatusCounts: getOrderStatusCountsTool,
  analyzeData: analyzeDataTool,
  exportExcelDynamic: exportExcelDynamicTool,
  getOrders: getOrdersTool,
  // Sandbox tools
  executeCode: executeCodeTool,
  bash: bashTool,
  readFile: readFileTool,
  writeFile: writeFileTool,
} as const;

export type ToolName = keyof typeof toolRegistry;

