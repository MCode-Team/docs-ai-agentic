import { db } from "@/lib/db";
import { getCoreFiles } from "./core-files";
import { getRecentDailyMemories } from "./daily-memory";
import type { CoreFileKey } from "./types";

export type ProfileExport = {
  version: "1";
  exportedAt: string;
  user: { userCode?: string };
  coreFiles: Record<CoreFileKey, { content: string; version: number; updatedAt: string }>;
  daily: Array<{ day: string; content: string; updatedAt: string }>;
  facts: Array<{ type: string; content: string; importance: number; createdAt: string; expiresAt: string | null }>;
};

export async function exportProfile(userId: string, opts?: { dailyDays?: number; factsLimit?: number }): Promise<ProfileExport> {
  const dailyDays = Math.max(0, Math.min(180, opts?.dailyDays ?? 30));
  const factsLimit = Math.max(0, Math.min(500, opts?.factsLimit ?? 100));

  const core = await getCoreFiles(userId);
  const daily = dailyDays > 0 ? await getRecentDailyMemories(userId, dailyDays) : [];

  const facts = factsLimit > 0
    ? await db<{
        factType: string;
        content: string;
        importance: number;
        createdAt: Date;
        expiresAt: Date | null;
      }[]>`
        SELECT fact_type as "factType",
               content,
               importance,
               created_at as "createdAt",
               expires_at as "expiresAt"
        FROM memory_facts
        WHERE user_id = ${userId}
        ORDER BY importance DESC, created_at DESC
        LIMIT ${factsLimit}
      `
    : [];

  return {
    version: "1",
    exportedAt: new Date().toISOString(),
    user: {},
    coreFiles: {
      IDENTITY: { content: core.IDENTITY.content, version: core.IDENTITY.version, updatedAt: String(core.IDENTITY.updatedAt) },
      USER: { content: core.USER.content, version: core.USER.version, updatedAt: String(core.USER.updatedAt) },
      SOUL: { content: core.SOUL.content, version: core.SOUL.version, updatedAt: String(core.SOUL.updatedAt) },
      MEMORY: { content: core.MEMORY.content, version: core.MEMORY.version, updatedAt: String(core.MEMORY.updatedAt) },
    },
    daily: daily.map((d) => ({ day: d.day, content: d.content, updatedAt: String(d.updatedAt) })),
    facts: facts.map((f) => ({
      type: f.factType,
      content: f.content,
      importance: f.importance,
      createdAt: String(f.createdAt),
      expiresAt: f.expiresAt ? String(f.expiresAt) : null,
    })),
  };
}
