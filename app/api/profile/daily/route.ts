import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { getDailyMemory, updateDailyMemory, getRecentDailyMemories } from "@/lib/profile";

const USER_COOKIE_NAME = "user_code";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  const url = new URL(req.url);
  const day = url.searchParams.get("day");
  const recent = url.searchParams.get("recent");

  if (recent) {
    const days = Math.max(1, Math.min(30, Number(recent) || 3));
    const rows = await getRecentDailyMemories(user.id, days);
    const res = NextResponse.json({ ok: true, user: { id: user.id, userCode: user.userCode }, recent: rows });
    if (!existing) {
      res.cookies.set({
        name: USER_COOKIE_NAME,
        value: user.userCode,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return res;
  }

  if (!day) {
    return NextResponse.json({ ok: false, error: "day is required (YYYY-MM-DD) or use ?recent=N" }, { status: 400 });
  }

  const row = await getDailyMemory(user.id, day);
  const res = NextResponse.json({ ok: true, user: { id: user.id, userCode: user.userCode }, day: row });
  if (!existing) {
    res.cookies.set({
      name: USER_COOKIE_NAME,
      value: user.userCode,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  const url = new URL(req.url);
  const day = url.searchParams.get("day");
  if (!day) {
    return NextResponse.json({ ok: false, error: "day is required (YYYY-MM-DD)" }, { status: 400 });
  }

  let body: { content?: string };
  try {
    body = (await req.json()) as { content?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ ok: false, error: "content is required" }, { status: 400 });
  }

  const updated = await updateDailyMemory(user.id, day, { content: body.content });
  const res = NextResponse.json({ ok: true, day: updated });
  if (!existing) {
    res.cookies.set({
      name: USER_COOKIE_NAME,
      value: user.userCode,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}
