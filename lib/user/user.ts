import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import type { User, CreateUserInput, UpdateUserInput } from "./types";

/**
 * Generate a unique user code (e.g., "user_abc123")
 */
export function generateUserCode(): string {
    return `user_${createId().slice(0, 8)}`;
}

/**
 * Get or create an anonymous user
 */
export async function getOrCreateUser(userCode?: string): Promise<User> {
    if (userCode) {
        const existing = await db<User[]>`
      SELECT id, user_code as "userCode", name, avatar_url as "avatarUrl", 
             created_at as "createdAt", last_seen_at as "lastSeenAt"
      FROM users WHERE user_code = ${userCode}
    `;
        if (existing.length > 0) {
            // Update last_seen_at
            await db`UPDATE users SET last_seen_at = now() WHERE user_code = ${userCode}`;
            return existing[0];
        }
    }

    // Create new user
    const id = createId();
    const code = userCode || generateUserCode();

    const [user] = await db<User[]>`
    INSERT INTO users (id, user_code)
    VALUES (${id}, ${code})
    RETURNING id, user_code as "userCode", name, avatar_url as "avatarUrl", 
              created_at as "createdAt", last_seen_at as "lastSeenAt"
  `;

    // Create default preferences
    await db`
    INSERT INTO user_preferences (user_id)
    VALUES (${id})
  `;

    return user;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
    const [user] = await db<User[]>`
    SELECT id, user_code as "userCode", name, avatar_url as "avatarUrl", 
           created_at as "createdAt", last_seen_at as "lastSeenAt"
    FROM users WHERE id = ${id}
  `;
    return user || null;
}

/**
 * Get user by user code
 */
export async function getUserByCode(userCode: string): Promise<User | null> {
    const [user] = await db<User[]>`
    SELECT id, user_code as "userCode", name, avatar_url as "avatarUrl", 
           created_at as "createdAt", last_seen_at as "lastSeenAt"
    FROM users WHERE user_code = ${userCode}
  `;
    return user || null;
}

/**
 * Update user profile
 */
export async function updateUser(
    id: string,
    input: UpdateUserInput
): Promise<User | null> {
    const updates: string[] = [];
    const values: Record<string, unknown> = {};

    if (input.name !== undefined) {
        updates.push("name");
        values.name = input.name;
    }
    if (input.avatarUrl !== undefined) {
        updates.push("avatar_url");
        values.avatarUrl = input.avatarUrl;
    }

    if (updates.length === 0) return getUserById(id);

    const [user] = await db<User[]>`
    UPDATE users SET
      name = COALESCE(${input.name ?? null}, name),
      avatar_url = COALESCE(${input.avatarUrl ?? null}, avatar_url),
      last_seen_at = now()
    WHERE id = ${id}
    RETURNING id, user_code as "userCode", name, avatar_url as "avatarUrl", 
              created_at as "createdAt", last_seen_at as "lastSeenAt"
  `;

    return user || null;
}

/**
 * Delete user and all related data
 */
export async function deleteUser(id: string): Promise<boolean> {
    const result = await db`DELETE FROM users WHERE id = ${id}`;
    return result.count > 0;
}
