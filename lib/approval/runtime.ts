type PendingToolCall = {
  id: string;
  toolName: string;
  input: any;
  createdAt: number;
  status: "pending" | "approved" | "rejected" | "executed";
};

const pendingCalls = new Map<string, PendingToolCall>();

export function createPendingToolCall(call: Omit<PendingToolCall, "status">) {
  const item: PendingToolCall = { ...call, status: "pending" };
  pendingCalls.set(call.id, item);
  return item;
}

export function getPendingToolCall(id: string) {
  return pendingCalls.get(id);
}

export function updatePendingToolCall(id: string, patch: Partial<PendingToolCall>) {
  const existing = pendingCalls.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  pendingCalls.set(id, updated);
  return updated;
}
