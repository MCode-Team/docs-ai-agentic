import { NextResponse } from "next/server";
import { getPendingToolCall, updatePendingToolCall } from "@/lib/approval/runtime";
import { toolRegistry, ToolName } from "@/lib/tools/registry";

export async function POST(req: Request) {
  const { approvalId } = await req.json();

  const pending = await getPendingToolCall(approvalId);
  if (!pending) {
    return NextResponse.json({ ok: false, error: "Pending call not found" }, { status: 404 });
  }

  if (pending.status !== "pending") {
    return NextResponse.json({ ok: false, error: "Not pending" }, { status: 400 });
  }

  updatePendingToolCall(approvalId, { status: "approved" }); // Can be fire-and-forget or awaited, safer to await for consistency but maybe okay not to block if strict consistency not needed. Let's await.
  await updatePendingToolCall(approvalId, { status: "approved" });

  const toolName = pending.toolName as ToolName;
  const toolObj = toolRegistry[toolName] as any;

  if (!toolObj.execute) {
    return NextResponse.json({ ok: false, error: "Tool not executable" }, { status: 400 });
  }

  try {
    const result = await toolObj.execute(pending.input, {
      toolCallId: approvalId,
      messages: [],
    });
    await updatePendingToolCall(approvalId, { status: "executed" });

    return NextResponse.json({ ok: true, toolName, input: pending.input, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Tool execution failed" },
      { status: 500 }
    );
  }
}
