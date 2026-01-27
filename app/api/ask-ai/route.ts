import { cookies } from "next/headers";
import { getOrCreateUser, getUserPreferences } from "@/lib/user";
import {
  initAgentState,
  runAgentLoop,
  type AgentState,
} from "@/lib/agent";
import { retrieveDocs } from "@/lib/retrieval-docs";
import { retrieveDictionary } from "@/lib/retrieval-dictionary";
import { rerankZeroRank2 } from "@/lib/rerank-zerank2";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from "ai";

export const maxDuration = 60;

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
 * Returns: Vercel AI SDK UI Message Stream
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
    response.headers.set(
      "Set-Cookie",
      `${USER_COOKIE_NAME}=${userCode}; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}; Path=/`
    );
  }

  return response;
}

/**
 * Agentic mode with planning, memory, and reflection
 * Uses Vercel AI SDK streaming format
 */
async function handleAgenticMode(
  userId: string,
  conversationId: string | null,
  question: string,
  messages: { role: string; content: string }[]
) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const textId = generateId();

      try {
        // Start the message container
        writer.write({
          type: "start",
          messageId: generateId(),
        });

        // 1. Acknowledge request immediately
        writer.write({
          type: "data-thinking",
          id: generateId(),
          data: { content: "Reading documents...", timestamp: Date.now() },
        } as any);

        // 2. Fetch sources (Blocking operation moved inside stream)
        const sources = await buildSources(question);

        // 3. Initialize agent state with pre-fetched sources
        const state = await initAgentState(userId, conversationId, question, sources);
        agentStates.set(state.conversationId, state);

        // 4. Run agent loop
        for await (const event of runAgentLoop(state)) {
          // Handle different event types
          switch (event.type) {
            case "thinking":
              writer.write({
                type: "data-thinking",
                id: generateId(),
                data: { content: event.content },
              } as any);
              break;

            case "plan_created":
              writer.write({
                type: "data-plan",
                id: generateId(),
                data: { plan: event.content },
              } as any);
              break;

            case "step_started":
              writer.write({
                type: "data-step",
                id: generateId(),
                data: {
                  stepIndex: event.stepIndex,
                  step: event.step as unknown as Record<string, unknown>,
                  timestamp: Date.now(),
                },
              } as any);
              break;

            case "tool_pending":
              // Write pending tool approval request
              writer.write({
                type: "data-tool-pending",
                id: generateId(),
                data: {
                  approvalId: event.approvalId!,
                  toolName: event.toolName!,
                  toolInput: event.toolInput,
                  sources: {
                    docs: sources.docs.map(d => ({ title: d.title, url: d.url })),
                    dictionary: sources.dictionary.map(d => ({ title: d.title, table: d.table }))
                  },
                },
              } as any);
              // Finish and stop streaming - waiting for approval
              writer.write({ type: "finish", finishReason: "stop" });
              return;

            case "tool_result":
              writer.write({
                type: "data-tool-result",
                id: generateId(),
                data: {
                  toolName: event.toolName!,
                  toolOutput: event.toolOutput,
                },
              } as any);
              break;

            case "answer":
              // Stream the actual text content using text-start, text-delta, text-end
              writer.write({ type: "text-start", id: textId });
              writer.write({ type: "text-delta", id: textId, delta: event.content });
              writer.write({ type: "text-end", id: textId });
              break;

            case "reflection":
              writer.write({
                type: "data-reflection",
                id: generateId(),
                data: { content: event.content },
              } as any);
              break;

            case "error":
              writer.write({
                type: "data-error",
                id: generateId(),
                data: { error: event.error! },
              } as any);
              break;

            case "complete":
              writer.write({
                type: "data-complete",
                id: generateId(),
                data: {
                  conversationId: event.content,
                  sources: {
                    docs: sources.docs.map(d => ({ title: d.title, url: d.url })),
                    dictionary: sources.dictionary.map(d => ({ title: d.title, table: d.table }))
                  },
                },
              } as any);
              break;
          }
        }

        // Finish the stream
        writer.write({ type: "finish", finishReason: "stop" });

      } catch (error: unknown) {
        console.error("Agent Loop Error:", error);
        writer.write({
          type: "data-error",
          id: generateId(),
          data: { error: error instanceof Error ? error.message : "Unknown error" },
        } as any);
        writer.write({ type: "finish", finishReason: "error" });
      }
    },
    onError: (error) => {
      console.error("Stream error:", error);
      return error instanceof Error ? error.message : "Unknown error";
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * Simple mode (legacy, non-agentic)
 */
async function handleSimpleMode(
  question: string,
  messages: { role: string; content: string }[]
) {
  const { openai } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");

  const sources = await buildSources(question);

  const docsContext = sources.docs
    .map((d, i) => `# DOC ${i + 1}\nTitle: ${d.title}\nURL: ${d.url}`)
    .join("\n---\n");

  const dictContext = sources.dictionary
    .map((d, i) => `# DB ${i + 1}\n${d.title}\nTable: ${d.table}`)
    .join("\n---\n");

  // Convert messages to model messages format
  const modelMessages = messages.map(m => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content
  }));

  const result = streamText({
    model: openai("gpt-5-nano"),
    system: `
คุณคือ Ask AI สำหรับ Docs + PostgreSQL
ตอบคำถามตามข้อมูลที่ให้มา

Docs Context:
${docsContext}

DB Dictionary Context:
${dictContext}
    `.trim(),
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
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
    docs: topDocs.map((d) => ({
      title: d.title,
      url: d.url,
      content: d.content
    })),
    dictionary: topDict.map((d) => ({
      title: d.title,
      table: `${d.schema_name}.${d.table_name}`,
      column: d.column_name || "*"
    })),
  };
}
