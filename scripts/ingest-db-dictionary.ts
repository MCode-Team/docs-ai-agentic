import { db } from "@/lib/db";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

type ColumnInfo = {
    schema_name: string;
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    column_comment: string | null;
    table_comment: string | null;
};

async function loadColumns(): Promise<ColumnInfo[]> {
    const rows = await db`
    SELECT
      c.table_schema AS schema_name,
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      col_description(format('%s.%s', c.table_schema, c.table_name)::regclass::oid, c.ordinal_position) AS column_comment,
      obj_description(format('%s.%s', c.table_schema, c.table_name)::regclass::oid, 'pg_class') AS table_comment
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `;

    return rows as unknown as ColumnInfo[];
}

function buildColumnContent(col: ColumnInfo) {
    const base = [
        `Schema: ${col.schema_name}`,
        `Table: ${col.table_name}`,
        `Column: ${col.column_name}`,
        `Type: ${col.data_type}`,
        `Nullable: ${col.is_nullable}`,
        `Default: ${col.column_default ?? "-"}`,
    ];

    const comment = col.column_comment?.trim()
        ? `Meaning: ${col.column_comment.trim()}`
        : `Meaning: (ไม่มี COMMENT กำกับ)`;

    const tableComment = col.table_comment?.trim()
        ? `Table Description: ${col.table_comment.trim()}`
        : `Table Description: (ไม่มี COMMENT ตาราง)`;

    return `${base.join("\n")}\n${tableComment}\n${comment}`;
}

async function main() {
    const cols = await loadColumns();
    console.log("Loaded columns:", cols.length);

    await db`TRUNCATE TABLE db_dictionary_chunks RESTART IDENTITY;`;

    for (const col of cols) {
        const title = `${col.schema_name}.${col.table_name}.${col.column_name}`;
        const content = buildColumnContent(col);

        const { embedding } = await embed({
            model: openai.embedding("text-embedding-3-small"),
            value: content,
        });

        await db`
      INSERT INTO db_dictionary_chunks (schema_name, table_name, column_name, title, content, embedding, embedding_model)
      VALUES (${col.schema_name}, ${col.table_name}, ${col.column_name}, ${title}, ${content}, ${JSON.stringify(embedding)}::vector, 'text-embedding-3-small')
      `;
    }

    console.log("✅ db_dictionary_chunks done");
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
