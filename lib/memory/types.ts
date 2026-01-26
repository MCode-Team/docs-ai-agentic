// Memory Types for Agentic Memory

export interface Conversation {
    id: string;
    userId: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Message {
    id: number;
    conversationId: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolName: string | null;
    toolInput: Record<string, unknown> | null;
    toolOutput: Record<string, unknown> | null;
    createdAt: Date;
}

export interface MemoryFact {
    id: number;
    conversationId: string | null;
    userId: string;
    factType: "preference" | "context" | "entity" | "summary";
    content: string;
    embedding: number[] | null;
    importance: number;
    createdAt: Date;
    expiresAt: Date | null;
}

export type CreateMessageInput = {
    role: Message["role"];
    content: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: Record<string, unknown>;
};

export type CreateFactInput = {
    conversationId?: string;
    userId: string;
    factType: MemoryFact["factType"];
    content: string;
    embedding?: number[];
    importance?: number;
    expiresAt?: Date;
};
