export type CoreFileKey = "IDENTITY" | "USER" | "SOUL" | "MEMORY";

export interface CoreFile {
  id: number;
  userId: string;
  fileKey: CoreFileKey;
  content: string;
  version: number;
  updatedAt: Date;
}

export interface DailyMemory {
  id: number;
  userId: string;
  day: string; // YYYY-MM-DD
  content: string;
  updatedAt: Date;
}

export type UpdateCoreFileInput = {
  content: string;
  expectedVersion?: number; // optimistic concurrency
};

export type UpdateDailyMemoryInput = {
  content: string;
};
