import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser, updateUser, getUserPreferences, updateUserPreferences } from "@/lib/user";
import { createFact } from "@/lib/memory";
import { updateCoreFile } from "@/lib/profile";

const USER_COOKIE_NAME = "user_code";

type ImportedFactType = "preference" | "context" | "entity" | "summary";

type BootstrapImportPayload = {
  version?: string;
  // Mirrors the OpenClaw mental model: IDENTITY / USER / SOUL
  identity?: {
    name?: string;
    role?: string;
    tone?: string;
  };
  user?: {
    displayName?: string;
    timezone?: string;
    roles?: string[];
    projects?: string[];
    goals?: string[];
    workingStyle?: string[];
    preferences?: string[];
  };
  soul?: {
    principles?: string[];
    boundaries?: string[];
    do?: string[];
    dont?: string[];
  };
  // Generic facts (recommended)
  facts?: Array<{ type: ImportedFactType; facts: string[]; importance?: number }>;
  // Optional direct preference overrides
  preferences?: {
    language?: "th" | "en";
    responseTone?: "friendly" | "formal" | "concise";
    customInstructions?: string;
  };
};

function buildTriggerPromptTemplate(opts: { language: "th" | "en" }): string {
  if (opts.language === "en") {
    return [
      "You are an AI that has chatted with me for a long time.",
      "I am onboarding a NEW assistant and want to transfer my personal context in one shot.",
      "Return STRICT JSON ONLY (no markdown, no extra text).",
      "",
      "Goal: output a compact, accurate profile that a new assistant can use immediately.",
      "Rules:",
      "- Use only information you are confident about from our prior conversations.",
      "- If unknown, omit the field (do not guess).",
      "- Keep it concise; prefer bullet-like strings.",
      "",
      "Output JSON schema:",
      "{",
      "  \"version\": \"1\",",
      "  \"identity\": { \"name\": \"...\", \"role\": \"...\", \"tone\": \"...\" },",
      "  \"user\": {",
      "    \"displayName\": \"...\",",
      "    \"timezone\": \"...\",",
      "    \"roles\": [\"...\"],",
      "    \"projects\": [\"...\"],",
      "    \"goals\": [\"...\"],",
      "    \"workingStyle\": [\"...\"],",
      "    \"preferences\": [\"...\"]",
      "  },",
      "  \"soul\": {",
      "    \"principles\": [\"...\"],",
      "    \"boundaries\": [\"...\"],",
      "    \"do\": [\"...\"],",
      "    \"dont\": [\"...\"]",
      "  },",
      "  \"facts\": [",
      "    { \"type\": \"preference\", \"facts\": [\"...\"], \"importance\": 0.9 },",
      "    { \"type\": \"context\", \"facts\": [\"...\"], \"importance\": 0.8 }",
      "  ]",
      "}",
    ].join("\n");
  }

  // Thai
  return [
    "คุณคือ AI ที่คุยกับฉันมานาน และรู้จักฉันดีจากบทสนทนาที่ผ่านมา",
    "ฉันกำลังเริ่มใช้งานผู้ช่วย AI ตัวใหม่ และอยากย้ายบริบทส่วนตัวไปให้มันแบบครั้งเดียว (5 วินาที)",
    "ให้ตอบเป็น JSON ล้วนๆ เท่านั้น (ห้ามมี markdown / ข้อความอื่น)",
    "",
    "เป้าหมาย: สรุป ‘โปรไฟล์ที่ใช้ได้ทันที’ ให้ผู้ช่วยใหม่เข้าใจฉันเร็วที่สุด",
    "กติกา:",
    "- ใช้เฉพาะข้อมูลที่คุณมั่นใจว่ามาจากบทสนทนาจริงที่ผ่านมา",
    "- ถ้าไม่แน่ใจ ให้เว้น/ไม่ต้องเดา",
    "- เขียนสั้น กระชับ เป็นประโยค/บูลเล็ตในรูป string",
    "",
    "รูปแบบ JSON:",
    "{",
    "  \"version\": \"1\",",
    "  \"identity\": { \"name\": \"...\", \"role\": \"...\", \"tone\": \"...\" },",
    "  \"user\": {",
    "    \"displayName\": \"...\",",
    "    \"timezone\": \"...\",",
    "    \"roles\": [\"...\"],",
    "    \"projects\": [\"...\"],",
    "    \"goals\": [\"...\"],",
    "    \"workingStyle\": [\"...\"],",
    "    \"preferences\": [\"...\"]",
    "  },",
    "  \"soul\": {",
    "    \"principles\": [\"...\"],",
    "    \"boundaries\": [\"...\"],",
    "    \"do\": [\"...\"],",
    "    \"dont\": [\"...\"]",
    "  },",
    "  \"facts\": [",
    "    { \"type\": \"preference\", \"facts\": [\"...\"], \"importance\": 0.9 },",
    "    { \"type\": \"context\", \"facts\": [\"...\"], \"importance\": 0.8 },",
    "    { \"type\": \"entity\", \"facts\": [\"...\"], \"importance\": 0.7 },",
    "    { \"type\": \"summary\", \"facts\": [\"...\"], \"importance\": 0.6 }",
    "  ]",
    "}",
  ].join("\n");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = (url.searchParams.get("lang") === "en" ? "en" : "th") as "th" | "en";

  return NextResponse.json({
    ok: true,
    prompt: buildTriggerPromptTemplate({ language: lang }),
    note:
      lang === "en"
        ? "Paste the prompt into your existing AI, then POST the returned JSON here to import." 
        : "นำ prompt นี้ไปแปะใน AI ตัวเดิมที่คุยกับคุณมานาน แล้วเอา JSON ที่ได้มา POST กลับมาที่ endpoint นี้เพื่อ import",
  });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(existing);

  let body: BootstrapImportPayload;
  try {
    body = (await req.json()) as BootstrapImportPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // 1) Best-effort: set user display name
  const displayName = body.user?.displayName || body.identity?.name;
  if (displayName && typeof displayName === "string" && displayName.trim()) {
    await updateUser(user.id, { name: displayName.trim() });
  }

  // 2) Preferences (optional)
  const currentPrefs = await getUserPreferences(user.id);
  const mergedCustomInstructions = [
    body.preferences?.customInstructions,
    body.soul?.principles?.length ? `Principles:\n- ${body.soul.principles.join("\n- ")}` : null,
    body.soul?.boundaries?.length ? `Boundaries:\n- ${body.soul.boundaries.join("\n- ")}` : null,
    body.user?.workingStyle?.length ? `Working style:\n- ${body.user.workingStyle.join("\n- ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  // Only update if something provided; otherwise keep current
  if (body.preferences?.language || body.preferences?.responseTone || mergedCustomInstructions) {
    await updateUserPreferences(user.id, {
      language: body.preferences?.language ?? currentPrefs?.language,
      responseTone: body.preferences?.responseTone ?? currentPrefs?.responseTone,
      customInstructions: mergedCustomInstructions || currentPrefs?.customInstructions,
    });
  }

  // 3) OpenClaw-style core files (write to user_core_files)
  // Build markdown content so the agent can read it every turn.
  const identityMd = [
    body.identity?.name ? `- Name: ${body.identity.name}` : null,
    body.identity?.role ? `- Role: ${body.identity.role}` : null,
    body.identity?.tone ? `- Vibe/Tone: ${body.identity.tone}` : null,
  ].filter(Boolean).join("\n");

  const userMd = [
    body.user?.displayName ? `- Name: ${body.user.displayName}` : null,
    body.user?.timezone ? `- Timezone: ${body.user.timezone}` : null,
    body.user?.roles?.length ? `- Roles:\n  - ${body.user.roles.join("\n  - ")}` : null,
    body.user?.projects?.length ? `- Projects:\n  - ${body.user.projects.join("\n  - ")}` : null,
    body.user?.goals?.length ? `- Goals:\n  - ${body.user.goals.join("\n  - ")}` : null,
    body.user?.workingStyle?.length ? `- Working style:\n  - ${body.user.workingStyle.join("\n  - ")}` : null,
    body.user?.preferences?.length ? `- Preferences:\n  - ${body.user.preferences.join("\n  - ")}` : null,
  ].filter(Boolean).join("\n\n");

  const soulMd = [
    body.soul?.principles?.length ? `## Principles\n- ${body.soul.principles.join("\n- ")}` : null,
    body.soul?.boundaries?.length ? `## Boundaries\n- ${body.soul.boundaries.join("\n- ")}` : null,
    body.soul?.do?.length ? `## Do\n- ${body.soul.do.join("\n- ")}` : null,
    body.soul?.dont?.length ? `## Don't\n- ${body.soul.dont.join("\n- ")}` : null,
  ].filter(Boolean).join("\n\n");

  // MEMORY.md: store a compact summary of imported profile for long-term recall
  const memoryMd = [
    `Imported profile on ${new Date().toISOString()}`,
    identityMd ? `\n### IDENTITY\n${identityMd}` : null,
    userMd ? `\n### USER\n${userMd}` : null,
    soulMd ? `\n### SOUL\n${soulMd}` : null,
  ].filter(Boolean).join("\n");

  // Only overwrite if we received content (avoid nuking existing profiles)
  if (identityMd.trim()) await updateCoreFile(user.id, "IDENTITY", { content: identityMd });
  if (userMd.trim()) await updateCoreFile(user.id, "USER", { content: userMd });
  if (soulMd.trim()) await updateCoreFile(user.id, "SOUL", { content: soulMd });
  if (memoryMd.trim()) await updateCoreFile(user.id, "MEMORY", { content: memoryMd });

  // 4) Import facts
  const facts = body.facts ?? [];
  const createdFactIds: number[] = [];

  for (const group of facts) {
    if (!group || !Array.isArray(group.facts) || group.facts.length === 0) continue;
    const factType: ImportedFactType = group.type;
    const importance = typeof group.importance === "number" ? group.importance : 0.8;

    for (const content of group.facts) {
      if (!content || typeof content !== "string" || !content.trim()) continue;
      const fact = await createFact({
        conversationId: null,
        userId: user.id,
        factType,
        content: content.trim(),
        importance,
      });
      createdFactIds.push(fact.id);
    }
  }

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, userCode: user.userCode },
    imported: {
      displayName: displayName ?? null,
      coreFilesUpdated: {
        identity: Boolean(identityMd.trim()),
        user: Boolean(userMd.trim()),
        soul: Boolean(soulMd.trim()),
        memory: Boolean(memoryMd.trim()),
      },
      factCount: createdFactIds.length,
    },
  });

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
