import { db } from "../db";

type PendingToolCall = {
  id: string;
  toolName: string;
  input: any;
  createdAt: number;
  status: "pending" | "approved" | "rejected" | "executed";
};

// No longer using in-memory map
// const pendingCalls = new Map<string, PendingToolCall>();

export async function createPendingToolCall(call: Omit<PendingToolCall, "status">) {
  const item: PendingToolCall = { ...call, status: "pending" };

  await db`
    INSERT INTO tool_approvals (id, tool_name, input, status, created_at)
    VALUES (${item.id}, ${item.toolName}, ${item.input}, ${item.status}, ${item.createdAt})
  `;

  return item;
}

export async function getPendingToolCall(id: string) {
  const rows = await db`
    SELECT id, tool_name as "toolName", input, status, created_at as "createdAt"
    FROM tool_approvals
    WHERE id = ${id}
    LIMIT 1
  `;

  if (rows.length === 0) return undefined;

  // input is jsonb, so it should be automatically parsed by postgres.js
  // created_at is bigint, might need conversion if used as number
  const row = rows[0];

  return {
    ...row,
    createdAt: Number(row.createdAt)
  } as PendingToolCall;
}

export async function updatePendingToolCall(id: string, patch: Partial<PendingToolCall>) {
  // We construct the update query dynamically or check fields
  // For simplicity, we only typically update status

  if (patch.status) {
    await db`
      UPDATE tool_approvals
      SET status = ${patch.status}
      WHERE id = ${id}
    `;
  }

  // Return updated (fetch again)
  return getPendingToolCall(id);
}
