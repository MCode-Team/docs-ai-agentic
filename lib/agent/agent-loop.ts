import crypto from "crypto";
import type {
    AgentState,
    AgentEvent,
    PlanStep,
    ToolStep,
    PlannerContext,
} from "./types";
import type { Message } from "@/lib/memory/types";
import { generatePlan, shouldReplan } from "./planner";
import { reflect, extractFactsFromConversation, generateConversationTitle } from "./reflector";
import { toolRegistry, ToolName } from "@/lib/tools/registry";
import { createPendingToolCall, getPendingToolCall } from "@/lib/approval/runtime";
import { shouldAutoApproveTool, getUserPreferences } from "@/lib/user";
import {
    createConversation,
    getConversation,
    addMessage,
    getMessages,
    createFact,
    getUserFacts,
    updateConversationTitle,
} from "@/lib/memory";
import { retrieveDocs } from "@/lib/retrieval-docs";
import { retrieveDictionary } from "@/lib/retrieval-dictionary";
import { rerankZeroRank2 } from "@/lib/rerank-zerank2";

const MAX_ITERATIONS = 10;

/**
 * Initialize agent state
 */
export async function initAgentState(
    userId: string,
    conversationId: string | null,
    query: string
): Promise<AgentState> {
    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
        const conv = await createConversation(userId);
        convId = conv.id;
    }

    // Load previous messages
    const messages = await getMessages(convId, 20);

    return {
        conversationId: convId,
        userId,
        query,
        messages,
        plan: [],
        currentStepIndex: 0,
        toolResults: new Map(),
        reflections: [],
        isComplete: false,
    };
}

/**
 * Build context for planner
 */
async function buildPlannerContext(
    state: AgentState
): Promise<PlannerContext> {
    // Retrieve docs
    const docsCandidates = await retrieveDocs(state.query, 12);
    const docsReranked = await rerankZeroRank2(
        state.query,
        docsCandidates.map((c) => ({ id: c.id, text: c.content, meta: c }))
    );
    const topDocs = docsReranked
        .slice(0, 4)
        .map((x) => x.meta)
        .filter((m): m is NonNullable<typeof m> => !!m);

    // Retrieve dictionary
    const dictCandidates = await retrieveDictionary(state.query, 8);
    const topDict = dictCandidates.slice(0, 4);

    // Retrieve user facts
    const userFacts = await getUserFacts(state.userId, 10);

    // Get user preferences
    const prefs = await getUserPreferences(state.userId);

    const docsContext = topDocs
        .map((d, i) => `DOC${i + 1}: ${d.title}\n${d.content.slice(0, 500)}`)
        .join("\n---\n");

    const dictContext = topDict
        .map((d, i) => `DB${i + 1}: ${d.schema_name}.${d.table_name}.${d.column_name || "*"}`)
        .join("\n");

    const factsContext = userFacts
        .map((f) => `[${f.factType}] ${f.content}`)
        .join("\n");

    return {
        query: state.query,
        docsContext,
        dictContext,
        factsContext,
        recentMessages: state.messages.slice(-10),
        userPreferences: {
            language: prefs?.language || "th",
            responseTone: prefs?.responseTone || "friendly",
            customInstructions: prefs?.customInstructions || undefined,
        },
    };
}

/**
 * Execute a single tool step
 */
async function executeToolStep(
    state: AgentState,
    step: ToolStep
): Promise<AgentEvent> {
    const toolName = step.toolName as ToolName;
    const tool = toolRegistry[toolName];

    if (!tool) {
        return {
            type: "error",
            error: `Tool not found: ${toolName}`,
        };
    }

    // Check if tool should be auto-approved
    const autoApprove = await shouldAutoApproveTool(state.userId, toolName);

    if (!autoApprove) {
        // Create pending tool call for approval
        const approvalId = crypto.randomUUID();
        createPendingToolCall({
            id: approvalId,
            toolName,
            input: step.input,
            createdAt: Date.now(),
        });

        return {
            type: "tool_pending",
            toolName,
            toolInput: step.input,
            approvalId,
        };
    }

    // Auto-approved: execute immediately
    try {
        const result = await (tool as any).execute(step.input);
        state.toolResults.set(`${toolName}_${state.currentStepIndex}`, result);

        return {
            type: "tool_result",
            toolName,
            toolInput: step.input,
            toolOutput: result,
        };
    } catch (error) {
        return {
            type: "error",
            error: `Tool execution failed: ${error}`,
        };
    }
}

/**
 * Run the agent loop
 */
export async function* runAgentLoop(
    state: AgentState
): AsyncGenerator<AgentEvent> {
    let iterations = 0;

    // Save user message
    await addMessage(state.conversationId, {
        role: "user",
        content: state.query,
    });

    // Generate initial plan
    const context = await buildPlannerContext(state);
    state.plan = await generatePlan(context);

    yield {
        type: "plan_created",
        content: JSON.stringify(state.plan),
    };

    while (!state.isComplete && iterations < MAX_ITERATIONS) {
        iterations++;
        const step = state.plan[state.currentStepIndex];

        if (!step) {
            state.isComplete = true;
            break;
        }

        yield {
            type: "step_started",
            stepIndex: state.currentStepIndex,
            step,
        };

        // Execute based on step type
        if (step.type === "think") {
            yield {
                type: "thinking",
                content: step.thought,
            };
            state.currentStepIndex++;
        } else if (step.type === "tool") {
            const event = await executeToolStep(state, step);
            yield event;

            // If pending approval, pause and wait
            if (event.type === "tool_pending") {
                return; // Caller must resume after approval
            }

            // Check if we should replan
            const replanResult = await shouldReplan(
                state.query,
                state.plan.slice(0, state.currentStepIndex + 1),
                state.toolResults
            );

            if (replanResult.replan) {
                const newContext = await buildPlannerContext(state);
                const newPlan = await generatePlan(newContext);
                state.plan = newPlan;
                state.currentStepIndex = 0;

                yield {
                    type: "plan_created",
                    content: `Replanned: ${replanResult.reason}`,
                };
            } else {
                state.currentStepIndex++;
            }
        } else if (step.type === "answer") {
            // Save assistant message
            await addMessage(state.conversationId, {
                role: "assistant",
                content: step.content,
            });

            yield {
                type: "answer",
                content: step.content,
            };

            // Reflect and extract facts
            const reflection = await reflect(state);
            state.reflections.push(reflection.summary || "");

            yield {
                type: "reflection",
                content: reflection.summary,
            };

            // Extract and save facts
            const facts = await extractFactsFromConversation(
                state.query,
                step.content,
                state.toolResults
            );

            for (const factGroup of facts) {
                for (const factContent of factGroup.facts) {
                    await createFact({
                        conversationId: state.conversationId,
                        userId: state.userId,
                        factType: factGroup.type,
                        content: factContent,
                    });
                }
            }

            // Generate title if first message
            if (state.messages.length <= 1) {
                const title = await generateConversationTitle(state.query, step.content);
                await updateConversationTitle(state.conversationId, title);
            }

            state.isComplete = true;
        }
    }

    yield {
        type: "complete",
        content: state.conversationId,
    };
}

/**
 * Resume agent after tool approval
 */
export async function* resumeAgentAfterApproval(
    state: AgentState,
    approvalId: string,
    approved: boolean,
    toolOutput?: unknown
): AsyncGenerator<AgentEvent> {
    const pending = await getPendingToolCall(approvalId);
    if (!pending) {
        yield { type: "error", error: "Approval not found" };
        return;
    }

    if (!approved) {
        yield {
            type: "tool_rejected",
            toolName: pending.toolName,
            approvalId,
        };

        // Skip to answer step or replan
        const answerStep = state.plan.find((s) => s.type === "answer");
        if (answerStep) {
            state.currentStepIndex = state.plan.indexOf(answerStep);
        }
    } else {
        // Tool was approved and executed externally
        state.toolResults.set(
            `${pending.toolName}_${state.currentStepIndex}`,
            toolOutput
        );

        yield {
            type: "tool_approved",
            toolName: pending.toolName,
            toolOutput,
            approvalId,
        };

        state.currentStepIndex++;
    }

    // Continue the loop
    yield* runAgentLoop(state);
}
