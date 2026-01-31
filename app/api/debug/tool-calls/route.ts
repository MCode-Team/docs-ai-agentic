import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { db } from "@/lib/db";

const USER_COOKIE_NAME = "user_code";

/**
 * GET /api/debug/tool-calls?conversationId=...
 * Returns tool call audit messages for a conversation.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "Missing conversationId" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  // Verify conversation ownership
  const conv = await db<{ user_id: string }[]>`
    SELECT user_id
    FROM conversations
    WHERE id = ${conversationId}
    LIMIT 1
  `;
  if (conv.length === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (conv[0].user_id !== user.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const rows = await db<
    {
      id: number;
      created_at: Date;
      content: string;
      tool_name: string | null;
      tool_input: any;
      tool_output: any;
    }[]
  >`
    SELECT id, created_at, content, tool_name, tool_input, tool_output
    FROM conversation_messages
    WHERE conversation_id = ${conversationId}
      AND role = 'tool'
    ORDER BY created_at ASC
    LIMIT 500
  `;

  return NextResponse.json({ ok: true, toolCalls: rows });
}
