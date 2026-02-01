import { db } from "@/lib/db";
import { updateCoreFile } from "./core-files";
import { updateDailyMemory } from "./daily-memory";

export type ProfileImportPayload = {
  version?: string;
  coreFiles?: {
    IDENTITY?: { content?: string };
    USER?: { content?: string };
    SOUL?: { content?: string };
    MEMORY?: { content?: string };
  };
  daily?: Array<{ day: string; content: string }>;
  facts?: Array<{ type: string; content: string; importance?: number; expiresAt?: string | null }>;
};

export async function importProfile(userId: string, payload: ProfileImportPayload) {
  const updatedCore: Record<string, boolean> = {};

  const core = payload.coreFiles || {};
  for (const key of ["IDENTITY", "USER", "SOUL", "MEMORY"] as const) {
    const content = (core as any)[key]?.content;
    if (typeof content === "string") {
      await updateCoreFile(userId, key, { content });
      updatedCore[key] = true;
    }
  }

  let dailyCount = 0;
  for (const d of payload.daily || []) {
    if (!d?.day || typeof d.day !== "string" || typeof d.content !== "string") continue;
    await updateDailyMemory(userId, d.day, { content: d.content });
    dailyCount++;
  }

  let factsCount = 0;
  for (const f of payload.facts || []) {
    if (!f?.type || !f?.content) continue;
    const importance = typeof f.importance === "number" ? f.importance : 0.5;
    const expiresAt = f.expiresAt ? new Date(f.expiresAt) : null;

    await db`
      INSERT INTO memory_facts (conversation_id, user_id, fact_type, content, importance, expires_at)
      VALUES (NULL, ${userId}, ${f.type}, ${f.content}, ${importance}, ${expiresAt})
    `;
    factsCount++;
  }

  return { updatedCore, dailyCount, factsCount };
}
