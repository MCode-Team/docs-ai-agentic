// User and Preferences Types for Agentic Memory

export interface User {
    id: string;
    userCode: string;
    name: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    lastSeenAt: Date;
}

export interface UserPreferences {
    id: number;
    userId: string;
    language: "th" | "en";
    responseTone: "friendly" | "formal" | "concise";
    autoApproveTools: string[];
    customInstructions: string | null;
    updatedAt: Date;
}

export type CreateUserInput = {
    userCode?: string;
    name?: string;
};

export type UpdateUserInput = {
    name?: string;
    avatarUrl?: string;
};

export type UpdatePreferencesInput = Partial<
    Omit<UserPreferences, "id" | "userId" | "updatedAt">
>;
