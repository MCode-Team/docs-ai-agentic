import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { db } from "@/lib/db";

const USER_COOKIE_NAME = "user_code";

export async function GET() {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const rows = await db<
    {
      id: string;
      filename: string;
      created_at: Date;
      expires_at: Date;
    }[]
  >`
    SELECT id::text, filename, created_at, expires_at
    FROM analytics.artifacts
    WHERE user_id = ${user.id}
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 200
  `;

  return NextResponse.json({ ok: true, artifacts: rows });
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const rows = await db<
    {
      storage_path: string;
      user_id: string;
    }[]
  >`
    SELECT storage_path, user_id
    FROM analytics.artifacts
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  if (rows.length === 0) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (rows[0].user_id !== user.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  // best-effort delete file
  try {
    const fs = await import("fs/promises");
    await fs.unlink(rows[0].storage_path);
  } catch {}

  await db`DELETE FROM analytics.artifacts WHERE id = ${id}::uuid`;
  return NextResponse.json({ ok: true });
}
