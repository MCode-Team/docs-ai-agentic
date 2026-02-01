import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { getCoreFiles } from "@/lib/profile";

const USER_COOKIE_NAME = "user_code";

export async function GET() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  const core = await getCoreFiles(user.id);
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, userCode: user.userCode },
    coreFiles: {
      IDENTITY: core.IDENTITY,
      USER: core.USER,
      SOUL: core.SOUL,
      MEMORY: core.MEMORY,
    },
  });

  // Set cookie for new users (same behavior as /api/ask-ai)
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
