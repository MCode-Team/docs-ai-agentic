import { NextResponse } from "next/server";
import { getPendingToolCall, updatePendingToolCall } from "@/lib/approval/runtime";
import { toolRegistry, ToolName } from "@/lib/tools/registry";

export async function POST(req: Request) {
  const { approvalId } = await req.json();

  const pending = getPendingToolCall(approvalId);
  if (!pending) {
    return NextResponse.json({ ok: false, error: "Pending call not found" }, { status: 404 });
  }

  if (pending.status !== "pending") {
    return NextResponse.json({ ok: false, error: "Not pending" }, { status: 400 });
  }

  updatePendingToolCall(approvalId, { status: "approved" });

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
    updatePendingToolCall(approvalId, { status: "executed" });

    return NextResponse.json({ ok: true, toolName, input: pending.input, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Tool execution failed" },
      { status: 500 }
    );
  }
}
