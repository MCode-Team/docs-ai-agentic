import { NextResponse } from "next/server";
import { getPendingToolCall, updatePendingToolCall } from "@/lib/approval/runtime";

export async function POST(req: Request) {
  const { approvalId } = await req.json();

  const pending = await getPendingToolCall(approvalId);
  if (!pending) {
    return NextResponse.json({ ok: false, error: "Pending call not found" }, { status: 404 });
  }

  await updatePendingToolCall(approvalId, { status: "rejected" });

  return NextResponse.json({ ok: true });
}
