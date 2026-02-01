import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { getCoreFiles, updateCoreFile } from "@/lib/profile";
import type { CoreFileKey } from "@/lib/profile";

const USER_COOKIE_NAME = "user_code";

function normalizeKey(key: string): CoreFileKey | null {
  const k = key.toUpperCase();
  if (k === "IDENTITY" || k === "USER" || k === "SOUL" || k === "MEMORY") return k as CoreFileKey;
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const fileKey = normalizeKey(key);
  if (!fileKey) return NextResponse.json({ ok: false, error: "Invalid file key" }, { status: 400 });

  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  const core = await getCoreFiles(user.id);
  const res = NextResponse.json({ ok: true, file: core[fileKey] });
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

export async function PUT(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const fileKey = normalizeKey(key);
  if (!fileKey) return NextResponse.json({ ok: false, error: "Invalid file key" }, { status: 400 });

  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  let body: { content?: string; expectedVersion?: number };
  try {
    body = (await req.json()) as { content?: string; expectedVersion?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ ok: false, error: "content is required" }, { status: 400 });
  }

  try {
    const updated = await updateCoreFile(user.id, fileKey, {
      content: body.content,
      expectedVersion: body.expectedVersion,
    });
    const res = NextResponse.json({ ok: true, file: updated });
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
  } catch (e) {
    if (String(e) === "Error: VERSION_CONFLICT") {
      return NextResponse.json({ ok: false, error: "VERSION_CONFLICT" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
