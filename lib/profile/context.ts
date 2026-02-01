import type { CoreFile, DailyMemory } from "./types";

// Token budgeting: we approximate tokens ~= chars/4 (good enough to prevent prompt bloat).
function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

function clipToTokenBudget(text: string, tokenBudget: number): string {
  const t = (text || "").trim();
  if (!t) return "";
  if (tokenBudget <= 0) return "";

  const charBudget = tokenBudget * 4;
  if (t.length <= charBudget) return t;

  // Keep head; in personal profiles, the beginning tends to be most important.
  return t.slice(0, Math.max(0, charBudget)) + "\n\n[...truncated for token budget...]";
}

export type CoreContextBudget = {
  totalTokens?: number;
  identityTokens?: number;
  userTokens?: number;
  soulTokens?: number;
  memoryTokens?: number;
  dailyTotalTokens?: number;
  dailyPerFileTokens?: number;
  maxDailyFiles?: number;
};

const DEFAULT_BUDGET: Required<CoreContextBudget> = {
  totalTokens: 2800,
  identityTokens: 250,
  userTokens: 650,
  soulTokens: 750,
  memoryTokens: 800,
  dailyTotalTokens: 350,
  dailyPerFileTokens: 175,
  maxDailyFiles: 2,
};

/**
 * Render OpenClaw-style core context with a strict token budget.
 *
 * Priority is aligned with OpenClaw behavior:
 * SOUL > USER > IDENTITY > MEMORY > daily logs
 */
export function renderOpenClawStyleContext(input: {
  identity: CoreFile;
  user: CoreFile;
  soul: CoreFile;
  memory: CoreFile;
  daily: DailyMemory[];
  budget?: CoreContextBudget;
}): string {
  const budget = { ...DEFAULT_BUDGET, ...(input.budget || {}) };

  // Hard cap: if someone configures a huge budget by mistake, keep it sane.
  budget.totalTokens = Math.max(800, Math.min(6000, budget.totalTokens));

  // Apply per-section budgets
  const soul = clipToTokenBudget(input.soul.content, budget.soulTokens) || "(empty)";
  const user = clipToTokenBudget(input.user.content, budget.userTokens) || "(empty)";
  const identity = clipToTokenBudget(input.identity.content, budget.identityTokens) || "(empty)";
  const memory = clipToTokenBudget(input.memory.content, budget.memoryTokens) || "(empty)";

  // Daily: keep only most recent N files, and clip each.
  const dailyFiles = (input.daily || []).slice(0, budget.maxDailyFiles);
  const dailyRendered = dailyFiles
    .map((d) => {
      const clipped = clipToTokenBudget(d.content, budget.dailyPerFileTokens) || "(empty)";
      return `# memory/${d.day}.md\n${clipped}`;
    })
    .join("\n\n---\n\n");

  const parts: string[] = [
    "# OpenClaw Core Files (DB-backed)",
    "## SOUL.md",
    soul,
    "## USER.md",
    user,
    "## IDENTITY.md",
    identity,
    "## MEMORY.md",
    memory,
    "## Recent daily memory",
    dailyRendered || "(none)",
  ];

  // Enforce total budget by trimming from the end (lowest priority: daily, then MEMORY, then IDENTITY, ...)
  let out = parts.join("\n\n");
  while (estimateTokens(out) > budget.totalTokens) {
    // Remove daily first if present
    if (out.includes("## Recent daily memory") && dailyRendered) {
      out = out.replace(dailyRendered, "(omitted due to token budget)");
      continue;
    }
    // Then trim MEMORY
    if (out.includes("## MEMORY.md") && memory !== "(empty)") {
      const trimmed = clipToTokenBudget(input.memory.content, Math.max(50, Math.floor(budget.memoryTokens * 0.6)));
      out = out.replace(memory, trimmed || "(empty)");
      continue;
    }
    // Then trim IDENTITY
    if (out.includes("## IDENTITY.md") && identity !== "(empty)") {
      const trimmed = clipToTokenBudget(input.identity.content, Math.max(30, Math.floor(budget.identityTokens * 0.6)));
      out = out.replace(identity, trimmed || "(empty)");
      continue;
    }
    // Then trim USER
    if (out.includes("## USER.md") && user !== "(empty)") {
      const trimmed = clipToTokenBudget(input.user.content, Math.max(80, Math.floor(budget.userTokens * 0.6)));
      out = out.replace(user, trimmed || "(empty)");
      continue;
    }
    // Finally trim SOUL (last resort)
    if (out.includes("## SOUL.md") && soul !== "(empty)") {
      const trimmed = clipToTokenBudget(input.soul.content, Math.max(80, Math.floor(budget.soulTokens * 0.6)));
      out = out.replace(soul, trimmed || "(empty)");
      continue;
    }
    // If we still can't shrink, break to avoid infinite loop.
    break;
  }

  return out;
}
