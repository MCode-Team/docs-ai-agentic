import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import crypto from "crypto";

import { retrieveDocs } from "@/lib/retrieval-docs";
import { retrieveDictionary } from "@/lib/retrieval-dictionary";
import { rerankZeroRank2 } from "@/lib/rerank-zerank2";
import { createPendingToolCall } from "@/lib/approval/runtime";
import { toolRegistry, ToolName } from "@/lib/tools/registry";

export const runtime = "nodejs";

/**
 * This endpoint returns:
 * - { type: "answer", content }
 * - { type: "pendingTool", approvalId, toolName, input }
 */
export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
  const question = lastUser?.content ?? "";

  const docsCandidates = await retrieveDocs(question, 12);
  const docsReranked = await rerankZeroRank2(
    question,
    docsCandidates.map((c) => ({ id: c.id, text: c.content, meta: c }))
  );
  const topDocs = docsReranked.slice(0, 4).map((x) => x.meta).filter((m): m is NonNullable<typeof m> => !!m);

  const dictCandidates = await retrieveDictionary(question, 8);
  const topDict = dictCandidates.slice(0, 4);

  const docsContext = topDocs
    .map((d, i) => `# DOC ${i + 1}\nTitle: ${d.title}\nURL: ${d.url}\n${d.content}`)
    .join("\n---\n");

  const dictContext = topDict
    .map(
      (d, i) =>
        `# DB ${i + 1}\n${d.title}\nSchema.Table.Column: ${d.schema_name}.${d.table_name}.${d.column_name}\n${d.content}`
    )
    .join("\n---\n");

  const result = await generateText({
    model: openai("gpt-5-mini"),
    system: `
คุณคือ Ask AI สำหรับ Docs + PostgreSQL

ห้าม execute tool เองทันที
ถ้าต้องการเรียก tool ให้ตอบเป็น JSON เท่านั้น:

{
  "action": "tool",
  "toolName": "ชื่อTool",
  "input": { ... },
  "postToolMessage": "ข้อความที่จะให้ตอบต่อหลังได้ผล tool"
}

ถ้าไม่ต้องเรียก tool ให้ตอบ:

{
  "action": "answer",
  "content": "คำตอบ..."
}

Tools ที่มี:
- getSalesSummary(dateFrom,dateTo)
- getOrderStatusCounts(dateFrom,dateTo)
- analyzeData(rows, groupBy, sumField, topN)
- exportExcelDynamic(filename, sheets, styles, conditionalRules)

หมายเหตุ:
- ถ้าจะ export excel ให้ใส่ postToolMessage ว่าให้ส่งลิงก์ไฟล์ + สรุปสิ่งที่สร้าง
- ถ้าดึงข้อมูลแล้ว ให้สรุปทันทีใน postToolMessage
    `.trim(),
    messages: [
      ...messages,
      { role: "system", content: `Docs Context:\n${docsContext}` },
      { role: "system", content: `DB Dictionary Context:\n${dictContext}` },
    ],
  });

  let parsed: any;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    return NextResponse.json({ type: "answer", content: result.text });
  }

  const sources = {
    docs: topDocs.map(d => ({ title: d.title, url: d.url })),
    dictionary: topDict.map(d => ({ title: d.title, table: `${d.schema_name}.${d.table_name}` }))
  };

  if (parsed.action === "answer") {
    return NextResponse.json({ type: "answer", content: parsed.content ?? "", sources });
  }

  if (parsed.action === "tool") {
    const toolName = parsed.toolName as ToolName;
    if (!toolRegistry[toolName]) {
      return NextResponse.json({ type: "answer", content: `ไม่พบ Tool: ${toolName}`, sources });
    }

    const approvalId = crypto.randomUUID();
    const pending = createPendingToolCall({
      id: approvalId,
      toolName,
      input: parsed.input ?? {},
      createdAt: Date.now(),
    });

    return NextResponse.json({
      type: "pendingTool",
      approvalId: pending.id,
      toolName: pending.toolName,
      input: pending.input,
      postToolMessage: parsed.postToolMessage ?? "ช่วยสรุปผลจาก tool output ให้หน่อย",
      sources
    });
  }

  return NextResponse.json({ type: "answer", content: "ไม่สามารถประมวลผลได้", sources });
}
