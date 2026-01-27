import { tool } from "ai";
import { z } from "zod";

const SANDBOX_URL = process.env.SANDBOX_URL || "http://localhost:8000";

/**
 * Execute bash commands in sandbox
 */
export const bashTool = tool({
    description: `Execute bash commands in a sandboxed environment.
Use this for:
- Running shell commands (ls, cat, grep, etc.)
- File manipulation
- System operations

Commands run in a workspace directory. Max timeout: 120 seconds.`,

    parameters: z.object({
        command: z.string().describe("Bash command to execute"),
        timeout: z.number().default(30).describe("Execution timeout in seconds (max 120)"),
    }),

    execute: async ({ command, timeout }: { command: string; timeout: number }) => {
        try {
            const response = await fetch(`${SANDBOX_URL}/bash`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    command,
                    timeout: Math.min(timeout, 120),
                }),
            });

            if (!response.ok) {
                throw new Error(`Sandbox error: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: result.success,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                error: result.error,
            };
        } catch (error) {
            return {
                success: false,
                stdout: "",
                stderr: "",
                exitCode: -1,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    },
} as any);

/**
 * Read file from sandbox workspace
 */
export const readFileTool = tool({
    description: `Read a file from the sandbox workspace.
Returns the file content as a string.`,

    parameters: z.object({
        path: z.string().describe("File path relative to workspace"),
    }),

    execute: async ({ path }: { path: string }) => {
        try {
            const response = await fetch(`${SANDBOX_URL}/read-file`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            });

            if (!response.ok) {
                throw new Error(`Sandbox error: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: result.success,
                content: result.content,
                error: result.error,
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    },
} as any);

/**
 * Write file to sandbox workspace
 */
export const writeFileTool = tool({
    description: `Write content to a file in the sandbox workspace.
Creates parent directories if needed.`,

    parameters: z.object({
        path: z.string().describe("File path relative to workspace"),
        content: z.string().describe("Content to write to the file"),
    }),

    execute: async ({ path, content }: { path: string; content: string }) => {
        try {
            const response = await fetch(`${SANDBOX_URL}/write-file`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, content }),
            });

            if (!response.ok) {
                throw new Error(`Sandbox error: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: result.success,
                path: result.path,
                error: result.error,
            };
        } catch (error) {
            return {
                success: false,
                path: null,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    },
} as any);
