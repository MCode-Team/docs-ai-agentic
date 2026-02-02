import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCoreFiles, getRecentDailyMemories, updateCoreFile } from "@/lib/profile";

function clip(text: string, max = 8000) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n\n[...truncated...]";
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided = req.headers.get("x-cron-secret") || url.searchParams.get("secret");

  if (secret && provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const limit = Math.max(1, Math.min(20, Number(body?.limit || 5)));
  const days = Math.max(1, Math.min(14, Number(body?.days || 3)));

  // Pick due jobs
  const jobs = await db<{ userId: string }[]>`
    SELECT user_id as "userId"
    FROM memory_maintenance_queue
    WHERE status = 'pending'
      AND run_after <= now()
    ORDER BY run_after ASC
    LIMIT ${limit}
  `;

  const processed: Array<{ userId: string; ok: boolean; error?: string }> = [];

  for (const j of jobs) {
    // Mark running
    await db`
      UPDATE memory_maintenance_queue
      SET status = 'running', updated_at = now()
      WHERE user_id = ${j.userId}
    `;

    try {
      const core = await getCoreFiles(j.userId);
      const daily = await getRecentDailyMemories(j.userId, days);

      const dailyText = daily
        .map((d) => `# memory/${d.day}.md\n${clip(d.content, 2000)}`)
        .join("\n\n---\n\n");

      const { generateText } = await import("ai");
      const { getChatModel } = await import("@/lib/llm");

      const system = [
        "You are a memory curator.",
        "Update MEMORY.md for a personal assistant.",
        "Rules:",
        "- Keep MEMORY.md concise and stable.",
        "- Prefer bullet points.",
        "- Do not include secrets like passwords/keys.",
        "- Output ONLY the updated MEMORY.md content (no markdown fences).",
      ].join("\n");

      const userMsg = [
        "CURRENT MEMORY.md:",
        clip(core.MEMORY.content, 8000) || "(empty)",
        "\n\nRECENT DAILY LOGS:",
        dailyText || "(none)",
        "\n\nTASK:",
        "Rewrite MEMORY.md to incorporate any durable facts/goals/preferences from the recent daily logs.",
        "If nothing durable exists, keep MEMORY.md mostly unchanged.",
      ].join("\n");

      const result = await generateText({
        model: getChatModel(),
        system,
        messages: [{ role: "user", content: userMsg }],
      });

      const updatedContent = result.text.trim();
      await updateCoreFile(j.userId, "MEMORY", { content: updatedContent });

      await db`
        UPDATE memory_maintenance_queue
        SET status = 'done', last_error = NULL, updated_at = now()
        WHERE user_id = ${j.userId}
      `;

      processed.push({ userId: j.userId, ok: true });
    } catch (e) {
      const err = String(e);
      await db`
        UPDATE memory_maintenance_queue
        SET status = 'error', last_error = ${err}, updated_at = now()
        WHERE user_id = ${j.userId}
      `;
      processed.push({ userId: j.userId, ok: false, error: err });
    }
  }

  return NextResponse.json({ ok: true, picked: jobs.length, processed });
}
