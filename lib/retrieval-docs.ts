import { db } from "./db";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

export interface DocChunk {
    id: number;
    doc_id: string;
    title: string;
    url: string;
    heading: string;
    content: string;
    score: number;
}

export async function retrieveDocs(query: string, topK = 12): Promise<DocChunk[]> {
    const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: query,
    });

    const rows = await db`
    SELECT id, doc_id, title, url, heading, content,
           1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS score
    FROM docs_chunks
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${topK}
  `;

    return rows as unknown as DocChunk[];
}
