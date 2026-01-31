import { tool } from "ai";
import { z } from "zod";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";

const ColumnSchema = z.object({
  key: z.string(),
  header: z.string().optional(),
  width: z.number().optional(),
  numFmt: z.string().optional(),
});

const SheetSchema = z.object({
  name: z.string(),
  columns: z.array(ColumnSchema).optional(),
  rows: z.array(z.record(z.string(), z.any())).default([]),
});

export const exportExcelArtifactTool = tool({
  description:
    "Export an Excel report as a time-limited artifact (default 24h) and return a download URL. Stored privately (not under /public).",
  parameters: z.object({
    userId: z.string().describe("Internal user id"),
    conversationId: z.string().nullable().optional(),
    filename: z.string().default("report.xlsx"),
    ttlHours: z.number().int().min(1).max(168).default(24),
    sheets: z.array(SheetSchema).min(1),
  }),
  execute: async ({ userId, conversationId, filename, ttlHours, sheets }) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ask AI";
    workbook.created = new Date();

    for (const sheet of sheets) {
      const ws = workbook.addWorksheet(sheet.name);
      const rows = sheet.rows || [];
      let columns = sheet.columns;

      if (!columns || columns.length === 0) {
        const keys = new Set<string>();
        rows.forEach((r: any) => Object.keys(r).forEach((k) => keys.add(k)));
        columns = Array.from(keys).map((k) => ({ key: k, header: k, width: 18 }));
      }

      ws.columns = columns.map((c: any) => ({
        key: c.key,
        header: c.header || c.key,
        width: c.width ?? 18,
        style: { numFmt: c.numFmt || undefined },
      }));

      // Header styling
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 20;

      for (const r of rows) ws.addRow(r);

      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: (columns?.length || 1) },
      };
    }

    const id = randomUUID();
    const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    const outDir = path.join(process.cwd(), "artifacts", "exports");
    await fs.mkdir(outDir, { recursive: true });

    const storagePath = path.join(outDir, `${id}-${safeName}`);
    await workbook.xlsx.writeFile(storagePath);

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000);

    await db`
      INSERT INTO analytics.artifacts (id, user_id, conversation_id, filename, storage_path, expires_at)
      VALUES (${id}::uuid, ${userId}, ${conversationId ?? null}, ${safeName}, ${storagePath}, ${expiresAt.toISOString()})
    `;

    return {
      ok: true,
      artifactId: id,
      filename: safeName,
      expiresAt: expiresAt.toISOString(),
      downloadUrl: `/api/artifacts/${id}`,
    };
  },
} as any);
