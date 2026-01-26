import { db } from "./db";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

export interface DictionaryChunk {
    id: number;
    schema_name: string;
    table_name: string;
    column_name: string;
    title: string;
    content: string;
    score: number;
}

export async function retrieveDictionary(query: string, topK = 8): Promise<DictionaryChunk[]> {
    const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: query,
    });

    const rows = await db`
    SELECT id, schema_name, table_name, column_name, title, content,
           1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS score
    FROM db_dictionary_chunks
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${topK}
  `;

    return rows as unknown as DictionaryChunk[];
}
