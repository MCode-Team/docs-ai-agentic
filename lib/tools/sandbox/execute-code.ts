import { tool } from "ai";
import { z } from "zod";

const SANDBOX_URL = process.env.SANDBOX_URL || "http://localhost:8000";

/**
 * Self-hosted Python Code Execution Tool
 * Executes Python code in an isolated Docker container
 */
export const executeCodeTool = tool({
    description: `Execute Python code in a sandboxed environment. 
Use this for:
- Mathematical calculations
- Data analysis and processing
- String manipulation
- Algorithm implementation

Available packages: numpy, pandas, math, json, re, datetime, collections, itertools, functools, heapq, statistics, random.

Important:
- Set a 'result' variable to return a value
- Code has a 30 second timeout
- Print statements will be captured in output`,

    parameters: z.object({
        code: z.string().describe("Python code to execute"),
        timeout: z.number().default(30).describe("Execution timeout in seconds (max 60)"),
    }),

    execute: async ({ code, timeout }: { code: string; timeout: number }) => {
        try {
            const response = await fetch(`${SANDBOX_URL}/execute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    code,
                    timeout: Math.min(timeout, 60),
                }),
            });

            if (!response.ok) {
                throw new Error(`Sandbox error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                return {
                    success: false,
                    error: result.error,
                    output: result.output || "",
                };
            }

            return {
                success: true,
                output: result.output,
                result: result.result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                output: "",
            };
        }
    },
} as any);

