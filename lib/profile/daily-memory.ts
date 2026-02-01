import { db } from "@/lib/db";
import type { DailyMemory, UpdateDailyMemoryInput } from "./types";

export async function getDailyMemory(userId: string, day: string): Promise<DailyMemory> {
  const [row] = await db<DailyMemory[]>`
    SELECT id,
           user_id as "userId",
           to_char(day, 'YYYY-MM-DD') as "day",
           content,
           updated_at as "updatedAt"
    FROM user_daily_memory
    WHERE user_id = ${userId}
      AND day = ${day}::date
  `;

  if (row) return row;

  const [created] = await db<DailyMemory[]>`
    INSERT INTO user_daily_memory (user_id, day, content)
    VALUES (${userId}, ${day}::date, '')
    RETURNING id, user_id as "userId", to_char(day, 'YYYY-MM-DD') as "day", content, updated_at as "updatedAt"
  `;

  return created;
}

export async function updateDailyMemory(userId: string, day: string, input: UpdateDailyMemoryInput): Promise<DailyMemory> {
  const [row] = await db<DailyMemory[]>`
    INSERT INTO user_daily_memory (user_id, day, content)
    VALUES (${userId}, ${day}::date, ${input.content})
    ON CONFLICT (user_id, day)
    DO UPDATE SET content = EXCLUDED.content, updated_at = now()
    RETURNING id, user_id as "userId", to_char(day, 'YYYY-MM-DD') as "day", content, updated_at as "updatedAt"
  `;

  return row;
}

export async function getRecentDailyMemories(userId: string, days = 3): Promise<DailyMemory[]> {
  // last N days including today
  return db<DailyMemory[]>`
    SELECT id,
           user_id as "userId",
           to_char(day, 'YYYY-MM-DD') as "day",
           content,
           updated_at as "updatedAt"
    FROM user_daily_memory
    WHERE user_id = ${userId}
    ORDER BY day DESC
    LIMIT ${days}
  `;
}
