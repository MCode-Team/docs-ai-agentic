// Agent Types for Agentic Loop

import type { Message } from "@/lib/memory/types";

export type PlanStepType = "tool" | "think" | "answer";

export interface ToolStep {
    type: "tool";
    toolName: string;
    input: Record<string, unknown>;
    reason: string;
}

export interface ThinkStep {
    type: "think";
    thought: string;
}

export interface AnswerStep {
    type: "answer";
    content: string;
}

export type PlanStep = ToolStep | ThinkStep | AnswerStep;

export interface AgentState {
    conversationId: string;
    userId: string;
    query: string;
    messages: Message[];
    plan: PlanStep[];
    currentStepIndex: number;
    toolResults: Map<string, unknown>;
    reflections: string[];
    isComplete: boolean;
}

export type AgentEventType =
    | "plan_created"
    | "step_started"
    | "tool_pending"
    | "tool_approved"
    | "tool_rejected"
    | "tool_result"
    | "thinking"
    | "reflection"
    | "answer"
    | "error"
    | "complete";

export interface AgentEvent {
    type: AgentEventType;
    stepIndex?: number;
    step?: PlanStep;
    content?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: unknown;
    approvalId?: string;
    error?: string;
}

export interface ReflectionResult {
    shouldContinue: boolean;
    shouldReplan: boolean;
    newPlan?: PlanStep[];
    summary?: string;
    insight?: string;
}

export interface PlannerContext {
    query: string;
    docsContext: string;
    dictContext: string;
    factsContext: string;
    recentMessages: Message[];
    userPreferences: {
        language: string;
        responseTone: string;
        customInstructions?: string;
    };
}
