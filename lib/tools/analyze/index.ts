// Analyze Tools
export { analyzeDataTool } from "./analyze-data";

// Re-export as grouped object
import { analyzeDataTool } from "./analyze-data";

export const analyzeTools = {
    analyzeData: analyzeDataTool,
} as const;
