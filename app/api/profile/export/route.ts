import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { exportProfile } from "@/lib/profile";

const USER_COOKIE_NAME = "user_code";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  const url = new URL(req.url);
  const dailyDays = url.searchParams.get("dailyDays") ? Number(url.searchParams.get("dailyDays")) : undefined;
  const factsLimit = url.searchParams.get("factsLimit") ? Number(url.searchParams.get("factsLimit")) : undefined;

  const data = await exportProfile(user.id, { dailyDays, factsLimit });

  const res = NextResponse.json({ ok: true, export: data });
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
