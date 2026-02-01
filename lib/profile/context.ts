import type { CoreFile, DailyMemory } from "./types";

function clip(text: string, max = 2000) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n\n[...truncated...]";
}

export function renderOpenClawStyleContext(input: {
  identity: CoreFile;
  user: CoreFile;
  soul: CoreFile;
  memory: CoreFile;
  daily: DailyMemory[];
}): string {
  const daily = input.daily
    .map((d) => `# memory/${d.day}.md\n${clip(d.content, 1200)}`)
    .join("\n\n---\n\n");

  return [
    "# OpenClaw Core Files (DB-backed)",
    "## IDENTITY.md",
    clip(input.identity.content, 1500) || "(empty)",
    "\n## USER.md",
    clip(input.user.content, 2000) || "(empty)",
    "\n## SOUL.md",
    clip(input.soul.content, 2000) || "(empty)",
    "\n## MEMORY.md",
    clip(input.memory.content, 2000) || "(empty)",
    daily ? `\n## Recent daily memory\n${daily}` : "\n## Recent daily memory\n(none)",
  ].join("\n\n");
}
