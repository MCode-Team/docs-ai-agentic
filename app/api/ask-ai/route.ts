import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser, getUserPreferences } from "@/lib/user";
import {
  initAgentState,
  runAgentLoop,
  type AgentState,
} from "@/lib/agent";
import { getMessages, addMessage } from "@/lib/memory";
import { retrieveDocs } from "@/lib/retrieval-docs";
import { retrieveDictionary } from "@/lib/retrieval-dictionary";
import { rerankZeroRank2 } from "@/lib/rerank-zerank2";
// export const runtime = "nodejs"; // Streaming preferred on edge or node with streaming support
export const maxDuration = 60; // Allow longer timeout for agent loop


const USER_COOKIE_NAME = "user_code";

// In-memory state store (for demo - use Redis in production)
const agentStates = new Map<string, AgentState>();

/**
 * POST /api/ask-ai
 * 
 * Body:
 * - messages: array of { role, content }
 * - conversationId?: string (optional, will create new if not provided)
 * - agentic?: boolean (use agentic mode, default: true)
 * 
 * Returns:
 * - { type: "answer", content, sources, conversationId }
 * - { type: "pendingTool", approvalId, toolName, input, conversationId }
 * - { type: "plan", steps, conversationId }
 * - { type: "thinking", content }
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  let userCode = cookieStore.get(USER_COOKIE_NAME)?.value;

  // Get or create user
  const user = await getOrCreateUser(userCode);
  userCode = user.userCode;

  const body = await req.json();
  const { messages, conversationId, agentic = true } = body;

  const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === "user");
  const question = lastUser?.content ?? "";

  // Set cookie for new users
  const response = agentic
    ? await handleAgenticMode(user.id, conversationId, question, messages)
    : await handleSimpleMode(question, messages);

  // Set cookie if new user
  if (!cookieStore.get(USER_COOKIE_NAME)?.value) {
    response.cookies.set(USER_COOKIE_NAME, userCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

/**
 * Agentic mode with planning, memory, and reflection
 */
/**
 * Agentic mode with planning, memory, and reflection
 */
async function handleAgenticMode(
  userId: string,
  conversationId: string | null,
  question: string,
  messages: { role: string; content: string }[]
) {
  // Initialize agent state
  const state = await initAgentState(userId, conversationId, question);
  agentStates.set(state.conversationId, state);

  // Get user preferences
  const prefs = await getUserPreferences(userId);

  // Create a stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Run agent loop and stream events
        for await (const event of runAgentLoop(state)) {
          // Send event chunk
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

          if (event.type === "tool_pending") {
            // Include sources with pending tool
            const sources = await buildSources(question);
            controller.enqueue(encoder.encode(JSON.stringify({
              type: "pendingTool",
              approvalId: event.approvalId,
              toolName: event.toolName,
              input: event.toolInput,
              sources
            }) + "\n"));
            controller.close();
            return;
          }
        }

        // Final answer and sources
        const sources = await buildSources(question);
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "finish",
          sources
        }) + "\n"));

        controller.close();
      } catch (error: any) {
        console.error("Agent Loop Error:", error);
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "error",
          error: error.message
        }) + "\n"));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked"
    }
  });
}

/**
 * Simple mode (legacy, non-agentic)
 */
async function handleSimpleMode(
  question: string,
  messages: { role: string; content: string }[]
) {
  const { openai } = await import("@ai-sdk/openai");
  const { generateText } = await import("ai");
  const { createPendingToolCall } = await import("@/lib/approval/runtime");
  const { toolRegistry } = await import("@/lib/tools/registry");
  type ToolName = import("@/lib/tools/registry").ToolName;
  const crypto = await import("crypto");

  const sources = await buildSources(question);

  const docsContext = sources.docs
    .map((d, i) => `# DOC ${i + 1}\nTitle: ${d.title}\nURL: ${d.url}`)
    .join("\n---\n");

  const dictContext = sources.dictionary
    .map((d, i) => `# DB ${i + 1}\n${d.title}\nTable: ${d.table}`)
    .join("\n---\n");

  const formattedMessages = messages.map(m => ({
    role: m.role as "user" | "assistant" | "system" | "tool",
    content: m.content
  }));

  const result = await generateText({
    model: openai("gpt-5-mini"),
    system: `
คุณคือ Ask AI สำหรับ Docs + PostgreSQL

ห้าม execute tool เองทันที
ถ้าต้องการเรียก tool ให้ตอบเป็น JSON เท่านั้น:

{
  "action": "tool",
  "toolName": "ชื่อTool",
  "input": { ... },
  "postToolMessage": "ข้อความที่จะให้ตอบต่อหลังได้ผล tool"
}

ถ้าไม่ต้องเรียก tool ให้ตอบ:

{
  "action": "answer",
  "content": "คำตอบ..."
}

Tools ที่มี:
- getSalesSummary(dateFrom,dateTo)
- getOrderStatusCounts(dateFrom,dateTo)
- analyzeData(rows, groupBy, sumField, topN)
- exportExcelDynamic(filename, sheets, styles, conditionalRules)
    `.trim(),
    messages: [
      ...(formattedMessages as any),
      { role: "system", content: `Docs Context:\n${docsContext}` },
      { role: "system", content: `DB Dictionary Context:\n${dictContext}` },
    ],
  });

  let parsed: { action?: string; content?: string; toolName?: string; input?: unknown; postToolMessage?: string };
  try {
    parsed = JSON.parse(result.text);
  } catch {
    return NextResponse.json({ type: "answer", content: result.text, sources });
  }

  if (parsed.action === "answer") {
    return NextResponse.json({
      type: "answer",
      content: parsed.content ?? "",
      sources,
    });
  }

  if (parsed.action === "tool") {
    const toolName = parsed.toolName as ToolName;
    if (!toolRegistry[toolName]) {
      return NextResponse.json({
        type: "answer",
        content: `ไม่พบ Tool: ${toolName}`,
        sources,
      });
    }

    const approvalId = crypto.randomUUID();
    const pending = createPendingToolCall({
      id: approvalId,
      toolName,
      input: (parsed.input ?? {}) as Record<string, unknown>,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      type: "pendingTool",
      approvalId: pending.id,
      toolName: pending.toolName,
      input: pending.input,
      postToolMessage: parsed.postToolMessage ?? "ช่วยสรุปผลจาก tool output ให้หน่อย",
      sources,
    });
  }

  return NextResponse.json({
    type: "answer",
    content: "ไม่สามารถประมวลผลได้",
    sources,
  });
}

/**
 * Build sources from retrieval
 */
async function buildSources(question: string) {
  const docsCandidates = await retrieveDocs(question, 12);
  const docsReranked = await rerankZeroRank2(
    question,
    docsCandidates.map((c) => ({ id: c.id, text: c.content, meta: c }))
  );
  const topDocs = docsReranked
    .slice(0, 4)
    .map((x) => x.meta)
    .filter((m): m is NonNullable<typeof m> => !!m);

  const dictCandidates = await retrieveDictionary(question, 8);
  const topDict = dictCandidates.slice(0, 4);

  return {
    docs: topDocs.map((d) => ({ title: d.title, url: d.url })),
    dictionary: topDict.map((d) => ({
      title: d.title,
      table: `${d.schema_name}.${d.table_name}`,
    })),
  };
}
