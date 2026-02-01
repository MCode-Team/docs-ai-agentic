import { db } from "@/lib/db";
import type { CoreFile, CoreFileKey, UpdateCoreFileInput } from "./types";

export async function getCoreFiles(userId: string): Promise<Record<CoreFileKey, CoreFile>> {
  const rows = await db<CoreFile[]>`
    SELECT id,
           user_id as "userId",
           file_key as "fileKey",
           content,
           version,
           updated_at as "updatedAt"
    FROM user_core_files
    WHERE user_id = ${userId}
  `;

  // Ensure all keys exist (should be created at user creation, but be defensive)
  const byKey = new Map(rows.map((r) => [r.fileKey as CoreFileKey, r]));
  const required: CoreFileKey[] = ["IDENTITY", "USER", "SOUL", "MEMORY"];

  // Backfill missing keys
  for (const key of required) {
    if (!byKey.has(key)) {
      const [created] = await db<CoreFile[]>`
        INSERT INTO user_core_files (user_id, file_key, content)
        VALUES (${userId}, ${key}, '')
        ON CONFLICT (user_id, file_key) DO UPDATE SET content = user_core_files.content
        RETURNING id, user_id as "userId", file_key as "fileKey", content, version, updated_at as "updatedAt"
      `;
      byKey.set(key, created);
    }
  }

  return {
    IDENTITY: byKey.get("IDENTITY")!,
    USER: byKey.get("USER")!,
    SOUL: byKey.get("SOUL")!,
    MEMORY: byKey.get("MEMORY")!,
  };
}

export async function updateCoreFile(
  userId: string,
  fileKey: CoreFileKey,
  input: UpdateCoreFileInput
): Promise<CoreFile> {
  // optimistic concurrency if expectedVersion provided
  if (typeof input.expectedVersion === "number") {
    const updated = await db<CoreFile[]>`
      UPDATE user_core_files
      SET content = ${input.content},
          version = version + 1,
          updated_at = now()
      WHERE user_id = ${userId}
        AND file_key = ${fileKey}
        AND version = ${input.expectedVersion}
      RETURNING id, user_id as "userId", file_key as "fileKey", content, version, updated_at as "updatedAt"
    `;

    if (updated.length === 0) {
      throw new Error("VERSION_CONFLICT");
    }

    return updated[0];
  }

  const [row] = await db<CoreFile[]>`
    UPDATE user_core_files
    SET content = ${input.content},
        version = version + 1,
        updated_at = now()
    WHERE user_id = ${userId}
      AND file_key = ${fileKey}
    RETURNING id, user_id as "userId", file_key as "fileKey", content, version, updated_at as "updatedAt"
  `;

  if (!row) throw new Error("NOT_FOUND");
  return row;
}
