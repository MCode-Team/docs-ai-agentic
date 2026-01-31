import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser, getUserPreferences, updateUserPreferences } from "@/lib/user";
import { toolRegistry } from "@/lib/tools/registry";

const USER_COOKIE_NAME = "user_code";

export async function GET() {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);
  const prefs = await getUserPreferences(user.id);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, userCode: user.userCode },
    preferences: prefs,
    toolNames: Object.keys(toolRegistry),
  });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const body = await req.json();
  const { autoApproveTools = [] } = body as { autoApproveTools?: string[] };

  // Validate tool names + block dangerous tools from auto-approve
  const allowed = new Set(Object.keys(toolRegistry));
  const blocked = new Set(["bash", "writeFile"]);
  const cleaned = (autoApproveTools || []).filter((t) => allowed.has(t) && !blocked.has(t));

  const updated = await updateUserPreferences(user.id, {
    autoApproveTools: cleaned,
  });

  return NextResponse.json({ ok: true, preferences: updated });
}
