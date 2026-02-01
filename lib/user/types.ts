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
    /** If true, auto-approve all tools except blocked ones (dangerous tools never auto-approved). */
    autoApproveAllTools: boolean;
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
