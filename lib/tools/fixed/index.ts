// Data Tools - Query & Analysis
export { getSalesSummaryTool } from "./get-sales-summary";
export { getOrderStatusCountsTool } from "./get-order-status-counts";
export { getOrdersTool } from "./get-orders";

// Re-export as grouped object
import { getSalesSummaryTool } from "./get-sales-summary";
import { getOrderStatusCountsTool } from "./get-order-status-counts";
import { getOrdersTool } from "./get-orders";

export const dataTools = {
    getSalesSummary: getSalesSummaryTool,
    getOrderStatusCounts: getOrderStatusCountsTool,
    getOrders: getOrdersTool,
} as const;
