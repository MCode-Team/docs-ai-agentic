import { db } from "@/lib/db";
import type { UserPreferences, UpdatePreferencesInput } from "./types";

/**
 * Get user preferences
 */
export async function getUserPreferences(
    userId: string
): Promise<UserPreferences | null> {
    const [prefs] = await db<UserPreferences[]>`
    SELECT id, user_id as "userId", language, 
           response_tone as "responseTone",
           auto_approve_tools as "autoApproveTools",
           auto_approve_all_tools as "autoApproveAllTools",
           custom_instructions as "customInstructions",
           updated_at as "updatedAt"
    FROM user_preferences WHERE user_id = ${userId}
  `;
    return prefs || null;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
    userId: string,
    input: UpdatePreferencesInput
): Promise<UserPreferences | null> {
    const [prefs] = await db<UserPreferences[]>`
    UPDATE user_preferences SET
      language = COALESCE(${input.language ?? null}, language),
      response_tone = COALESCE(${input.responseTone ?? null}, response_tone),
      auto_approve_tools = COALESCE(${input.autoApproveTools ?? null}, auto_approve_tools),
      auto_approve_all_tools = COALESCE(${(input as any).autoApproveAllTools ?? null}, auto_approve_all_tools),
      custom_instructions = COALESCE(${input.customInstructions ?? null}, custom_instructions),
      updated_at = now()
    WHERE user_id = ${userId}
    RETURNING id, user_id as "userId", language, 
              response_tone as "responseTone",
              auto_approve_tools as "autoApproveTools",
              auto_approve_all_tools as "autoApproveAllTools",
              custom_instructions as "customInstructions",
              updated_at as "updatedAt"
  `;
    return prefs || null;
}

/**
 * Check if a tool should be auto-approved for a user
 */
const SAFE_TOOLS = [
    // Fixed query tools (read-only)
    'getSalesSummary',
    'getOrderStatusCounts',
    'getOrders',

    // Analytics tools (read-only, aggregations)
    'analyzeData',
    'queryAggregate',
    'trendReport',
    'cohortReport',
    'dataQualityReport',
    'oosReport',
    'reportComposer',

    // Export tools (user-requested exports)
    'exportExcelDynamic',
    'exportExcelArtifact',

    // Code execution (sandboxed)
    'executeCode',
];

// Dangerous tools should never be auto-approved in SaaS.
const BLOCKED_TOOLS = ['bash', 'writeFile'];

export async function shouldAutoApproveTool(
    userId: string,
    toolName: string
): Promise<boolean> {
    // Never auto-approve blocked tools
    if (BLOCKED_TOOLS.includes(toolName)) {
        return false;
    }

    // Always approve safe tools
    if (SAFE_TOOLS.includes(toolName)) {
        return true;
    }

    const prefs = await getUserPreferences(userId);
    if (!prefs) return false;

    // If user opted in, auto-approve everything except blocked tools
    if ((prefs as any).autoApproveAllTools) {
        return true;
    }

    // Otherwise use allowlist
    return prefs.autoApproveTools.includes(toolName);
}
