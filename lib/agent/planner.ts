import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { PlanStep, PlannerContext } from "./types";
import { toolRegistry } from "@/lib/tools/registry";

const PLANNER_SYSTEM_PROMPT = `คุณคือ AI Planner ที่วางแผนการตอบคำถาม

วิเคราะห์คำถามและสร้าง plan เป็น JSON array ของ steps:

Step types:
1. { "type": "think", "thought": "..." } - คิดวิเคราะห์
2. { "type": "tool", "toolName": "...", "input": {...}, "reason": "..." } - เรียก tool
3. { "type": "answer", "content": "..." } - ตอบคำถาม

Tools ที่มี:
- getSalesSummary(dateFrom, dateTo) - ดึงสรุปยอดขาย
- getOrderStatusCounts(dateFrom, dateTo) - ดึงจำนวนคำสั่งซื้อตามสถานะ
- analyzeData(rows, groupBy, sumField, topN) - วิเคราะห์ข้อมูล
- exportExcelDynamic(filename, sheets, styles, conditionalRules) - export Excel

กฎ:
- ถ้าคำถามง่าย ตอบได้เลย ให้ใช้ answer step เดียว
- ถ้าต้องดึงข้อมูล ให้ใช้ tool step ก่อน แล้วค่อย answer
- ใส่ think step เมื่อต้องวิเคราะห์ซับซ้อน
- plan ต้องจบด้วย answer step เสมอ

ตอบเป็น JSON array เท่านั้น ห้ามใส่ markdown หรือ text อื่น`;

/**
 * Generate a plan for answering a query
 */
export async function generatePlan(context: PlannerContext): Promise<PlanStep[]> {
    const toolDescriptions = Object.keys(toolRegistry)
        .map((name) => `- ${name}`)
        .join("\n");

    const userContext = `
User Query: ${context.query}

Docs Context:
${context.docsContext || "(ไม่มี)"}

DB Dictionary:
${context.dictContext || "(ไม่มี)"}

User Facts:
${context.factsContext || "(ไม่มี)"}

Recent Conversation:
${context.recentMessages.slice(-5).map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join("\n") || "(ไม่มี)"}

User Preferences:
- Language: ${context.userPreferences.language}
- Tone: ${context.userPreferences.responseTone}
${context.userPreferences.customInstructions ? `- Custom: ${context.userPreferences.customInstructions}` : ""}

Available Tools:
${toolDescriptions}
`.trim();

    const result = await generateText({
        model: openai("gpt-5-mini"),
        system: PLANNER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContext }],
    });

    try {
        const plan = JSON.parse(result.text) as PlanStep[];
        return validatePlan(plan);
    } catch {
        // Fallback: simple answer
        return [{ type: "answer", content: result.text }];
    }
}

/**
 * Validate and fix plan structure
 */
function validatePlan(plan: PlanStep[]): PlanStep[] {
    if (!Array.isArray(plan) || plan.length === 0) {
        return [{ type: "answer", content: "ไม่สามารถสร้าง plan ได้" }];
    }

    // Ensure plan ends with an answer
    const lastStep = plan[plan.length - 1];
    if (lastStep.type !== "answer") {
        plan.push({ type: "answer", content: "..." });
    }

    // Validate tool steps
    return plan.filter((step) => {
        if (step.type === "tool") {
            return step.toolName && step.toolName in toolRegistry;
        }
        return true;
    });
}

/**
 * Check if we should replan based on tool results
 */
export async function shouldReplan(
    originalQuery: string,
    executedSteps: PlanStep[],
    toolResults: Map<string, unknown>
): Promise<{ replan: boolean; reason?: string }> {
    // Simple heuristics for now
    const lastToolResult = Array.from(toolResults.values()).pop();

    // If tool returned error, suggest replan
    if (
        lastToolResult &&
        typeof lastToolResult === "object" &&
        "error" in (lastToolResult as object)
    ) {
        return { replan: true, reason: "Tool returned an error" };
    }

    // If tool returned empty data, might need different approach
    if (
        lastToolResult &&
        Array.isArray(lastToolResult) &&
        lastToolResult.length === 0
    ) {
        return { replan: true, reason: "Tool returned no data" };
    }

    return { replan: false };
}
