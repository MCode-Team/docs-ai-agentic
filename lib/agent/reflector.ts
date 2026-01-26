import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { AgentState, ReflectionResult, PlanStep } from "./types";

const REFLECTOR_SYSTEM_PROMPT = `คุณคือ AI Reflector ที่ประเมินผลการทำงาน

วิเคราะห์ state และ tool results แล้วตอบเป็น JSON:

{
  "shouldContinue": true/false,  // ควรทำต่อไหม
  "shouldReplan": true/false,    // ต้องวางแผนใหม่ไหม
  "summary": "...",              // สรุปสิ่งที่ได้ทำ
  "insight": "..."               // ข้อสังเกต/บทเรียน (optional)
}

กฎ:
- shouldContinue = true ถ้ายังมี step ที่ต้องทำ
- shouldReplan = true ถ้าพบข้อมูลใหม่ที่ควรเปลี่ยนแผน
- summary ควรกระชับ 1-2 ประโยค
- insight คือสิ่งที่ควรจำไว้สำหรับครั้งหน้า

ตอบเป็น JSON เท่านั้น`;

/**
 * Reflect on agent state and decide next action
 */
export async function reflect(state: AgentState): Promise<ReflectionResult> {
    const toolResultsSummary = Array.from(state.toolResults.entries())
        .map(([key, value]) => {
            const valueStr = JSON.stringify(value);
            return `- ${key}: ${valueStr.slice(0, 200)}${valueStr.length > 200 ? "..." : ""}`;
        })
        .join("\n");

    const stateContext = `
Query: ${state.query}

Plan (${state.plan.length} steps):
${state.plan.map((s, i) => `${i + 1}. [${s.type}] ${s.type === "tool" ? s.toolName : s.type === "answer" ? s.content.slice(0, 50) : (s as { thought?: string }).thought?.slice(0, 50) || ""}`).join("\n")}

Current Step: ${state.currentStepIndex + 1}/${state.plan.length}

Tool Results:
${toolResultsSummary || "(ไม่มี)"}

Previous Reflections:
${state.reflections.slice(-3).join("\n") || "(ไม่มี)"}
`.trim();

    const result = await generateText({
        model: openai("gpt-5-mini"),
        system: REFLECTOR_SYSTEM_PROMPT,
        messages: [{ role: "user", content: stateContext }],
    });

    try {
        return JSON.parse(result.text) as ReflectionResult;
    } catch {
        // Default: continue if more steps, don't replan
        return {
            shouldContinue: state.currentStepIndex < state.plan.length - 1,
            shouldReplan: false,
            summary: "Continuing execution",
        };
    }
}

/**
 * Extract facts from completed conversation
 */
export async function extractFactsFromConversation(
    query: string,
    answer: string,
    toolResults: Map<string, unknown>
): Promise<{ facts: string[]; type: "preference" | "context" | "entity" | "summary" }[]> {
    const result = await generateText({
        model: openai("gpt-5-mini"),
        system: `Extract important facts to remember from this conversation.
Return JSON array: [{ "facts": ["fact1", "fact2"], "type": "preference|context|entity|summary" }]
Only extract facts that would be useful for future conversations.
Return [] if nothing important to remember.`,
        messages: [
            {
                role: "user",
                content: `Query: ${query}
Answer: ${answer}
Tool Results: ${JSON.stringify(Object.fromEntries(toolResults)).slice(0, 1000)}`,
            },
        ],
    });

    try {
        return JSON.parse(result.text);
    } catch {
        return [];
    }
}

/**
 * Generate conversation title from first exchange
 */
export async function generateConversationTitle(
    query: string,
    answer: string
): Promise<string> {
    const result = await generateText({
        model: openai("gpt-5-mini"),
        system: "Generate a short title (max 50 chars) for this conversation. Return only the title, no quotes.",
        messages: [
            { role: "user", content: `Q: ${query}\nA: ${answer.slice(0, 200)}` },
        ],
    });

    return result.text.slice(0, 50);
}
