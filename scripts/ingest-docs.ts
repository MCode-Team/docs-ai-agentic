import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

function chunkText(text: string, maxLen = 900) {
    const parts: string[] = [];
    let buf = "";
    for (const line of text.split("\n")) {
        if ((buf + "\n" + line).length > maxLen) {
            parts.push(buf.trim());
            buf = line;
        } else {
            buf += "\n" + line;
        }
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts;
}

async function main() {
    const docsDir = path.join(process.cwd(), "content/docs");
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".mdx"));

    await db`TRUNCATE TABLE docs_chunks RESTART IDENTITY;`;

    for (const file of files) {
        const full = fs.readFileSync(path.join(docsDir, file), "utf8");

        const docId = file.replace(".mdx", "");
        const title = docId;
        const url = `/docs/${docId}`;

        const chunks = chunkText(full);

        for (const content of chunks) {
            const { embedding } = await embed({
                model: openai.embedding("text-embedding-3-small"),
                value: content,
            });

            await db`
        INSERT INTO docs_chunks (doc_id, title, url, heading, content, embedding, embedding_model)
        VALUES (${docId}, ${title}, ${url}, ${null}, ${content}, ${JSON.stringify(embedding)}::vector, 'text-embedding-3-small')
        `;
        }

        console.log("✅ Ingested", file, "chunks:", chunks.length);
    }

    console.log("✅ docs_chunks done");
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
