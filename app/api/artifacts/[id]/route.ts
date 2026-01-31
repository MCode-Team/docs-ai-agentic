import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";

const USER_COOKIE_NAME = "user_code";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const rows = await db<
    {
      id: string;
      user_id: string;
      filename: string;
      storage_path: string;
      expires_at: Date;
    }[]
  >`
    SELECT id::text, user_id, filename, storage_path, expires_at
    FROM analytics.artifacts
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const artifact = rows[0];

  // Enforce ownership via cookie-based anonymous user
  if (artifact.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Ensure storage path is inside our artifacts directory
  const baseDir = path.join(process.cwd(), "artifacts", "exports");
  const resolved = path.resolve(artifact.storage_path);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 });
  }

  const now = new Date();

  if (artifact.expires_at && new Date(artifact.expires_at) <= now) {
    // Best-effort cleanup
    try {
      await fs.unlink(artifact.storage_path);
    } catch {}
    await db`DELETE FROM analytics.artifacts WHERE id = ${id}::uuid`;

    return NextResponse.json({ ok: false, error: "Expired" }, { status: 410 });
  }

  const buf = await fs.readFile(artifact.storage_path);

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        artifact.filename
      )}`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
