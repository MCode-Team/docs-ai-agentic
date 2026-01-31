import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs/promises";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db<
    {
      id: string;
      filename: string;
      storage_path: string;
      expires_at: Date;
    }[]
  >`
    SELECT id::text, filename, storage_path, expires_at
    FROM analytics.artifacts
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const artifact = rows[0];
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
