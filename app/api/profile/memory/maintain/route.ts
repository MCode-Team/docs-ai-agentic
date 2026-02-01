import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { getCoreFiles, getRecentDailyMemories, updateCoreFile } from "@/lib/profile";

const USER_COOKIE_NAME = "user_code";

function clip(text: string, max = 8000) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n\n[...truncated...]";
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  let body: { days?: number } = {};
  try {
    body = (await req.json()) as { days?: number };
  } catch {
    // ignore
  }

  const days = Math.max(1, Math.min(14, body.days ?? 3));
  const core = await getCoreFiles(user.id);
  const daily = await getRecentDailyMemories(user.id, days);

  const dailyText = daily
    .map((d) => `# memory/${d.day}.md\n${clip(d.content, 2000)}`)
    .join("\n\n---\n\n");

  // NOTE: This uses the same AI provider as the rest of the app. Requires OPENAI_API_KEY.
  const { openai } = await import("@ai-sdk/openai");
  const { generateText } = await import("ai");

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
    model: openai("gpt-5-mini"),
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  const updatedContent = result.text.trim();
  await updateCoreFile(user.id, "MEMORY", { content: updatedContent });

  const res = NextResponse.json({ ok: true, updated: { key: "MEMORY", length: updatedContent.length, daysUsed: days } });
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
