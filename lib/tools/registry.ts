/**
 * Tools Registry - Central registry for all AI tools
 * 
 * Categories:
 * - Data: Query and fetch data from database
 * - Analyze: Data analysis and processing
 * - Export: Export data to files
 * - Sandbox: Code execution (Python/Bash) and file operations
 */

import { dataTools } from "./fixed";
import { analyzeTools } from "./analyze";
import { exportTools } from "./export";
import { sandboxTools } from "./sandbox";
import { analyticsTools } from "./analytics";

// Main registry - all tools available to the agent
export const toolRegistry = {
  // Data tools
  ...dataTools,
  // Analytics tools
  ...analyticsTools,
  // Analysis tools
  ...analyzeTools,
  // Export tools
  ...exportTools,
  // Sandbox tools (Python, Bash, File I/O)
  ...sandboxTools,
} as const;

// Type for tool names
export type ToolName = keyof typeof toolRegistry;

// Grouped exports for selective use
export { dataTools, analyticsTools, analyzeTools, exportTools, sandboxTools };
