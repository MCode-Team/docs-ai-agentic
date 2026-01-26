import { tool } from "ai";
import { z } from "zod";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";

const ColumnSchema = z.object({
    key: z.string(),
    header: z.string(),
    width: z.number().optional(),
    numFmt: z.string().optional(),
});

const SheetSchema = z.object({
    name: z.string(),
    columns: z.array(ColumnSchema).min(1),
    rows: z.array(z.record(z.string(), z.any())).min(0),
});

const ConditionalRuleSchema = z.object({
    sheet: z.string(),
    columnKey: z.string(),
    type: z.enum(["gt", "lt"]).default("gt"),
    threshold: z.number(),
    fill: z.string().default("DCFCE7"),
});

export const exportExcelDynamicTool = tool({
    description:
        "Export Excel แบบ dynamic หลายชีต + header style + zebra + freeze + filter + conditional highlight",
    parameters: z.object({
        filename: z.string().default("export.xlsx"),
        sheets: z.array(SheetSchema).min(1),
        styles: z
            .object({
                headerFill: z.string().default("111827"),
                headerFontColor: z.string().default("FFFFFF"),
                zebra: z.boolean().default(true),
                freezeHeader: z.boolean().default(true),
                autoFilter: z.boolean().default(true),
            })
            .optional(),
        conditionalRules: z.array(ConditionalRuleSchema).optional().default([]),
    }),
    execute: async ({ filename, sheets, styles, conditionalRules }: { filename: string; sheets: any[]; styles?: any; conditionalRules: any[] }) => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Ask AI";
        workbook.created = new Date();

        const styleConfig = {
            headerFill: styles?.headerFill ?? "111827",
            headerFontColor: styles?.headerFontColor ?? "FFFFFF",
            zebra: styles?.zebra ?? true,
            freezeHeader: styles?.freezeHeader ?? true,
            autoFilter: styles?.autoFilter ?? true,
        };

        for (const sheet of sheets) {
            const ws = workbook.addWorksheet(sheet.name);

            ws.columns = sheet.columns.map((c) => ({
                key: c.key,
                header: c.header,
                width: c.width ?? 14,
                style: c.numFmt ? { numFmt: c.numFmt } : {},
            }));

            const headerRow = ws.getRow(1);
            headerRow.height = 20;

            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: styleConfig.headerFontColor } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: styleConfig.headerFill },
                };
                cell.alignment = { vertical: "middle", horizontal: "center" };
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });

            for (const r of sheet.rows) ws.addRow(r);

            if (styleConfig.zebra) {
                for (let i = 2; i <= ws.rowCount; i++) {
                    if ((i - 2) % 2 === 1) {
                        const row = ws.getRow(i);
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: "pattern",
                                pattern: "solid",
                                fgColor: { argb: "F9FAFB" },
                            };
                        });
                    }
                }
            }

            if (styleConfig.freezeHeader) ws.views = [{ state: "frozen", ySplit: 1 }];

            if (styleConfig.autoFilter) {
                ws.autoFilter = {
                    from: { row: 1, column: 1 },
                    to: { row: 1, column: sheet.columns.length },
                };
            }
        }

        for (const rule of conditionalRules || []) {
            const ws = workbook.getWorksheet(rule.sheet);
            if (!ws) continue;

            const colIndex = ws.columns.findIndex((c) => c.key === rule.columnKey);
            if (colIndex === -1) continue;

            const excelCol = colIndex + 1;
            for (let i = 2; i <= ws.rowCount; i++) {
                const cell = ws.getRow(i).getCell(excelCol);
                const val = Number(cell.value ?? 0);

                if (rule.type === "gt" && val > rule.threshold) {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rule.fill } };
                }
                if (rule.type === "lt" && val < rule.threshold) {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rule.fill } };
                }
            }
        }

        const outDir = path.join(process.cwd(), process.env.EXPORT_PUBLIC_DIR || "public/exports");
        await fs.mkdir(outDir, { recursive: true });

        const outPath = path.join(outDir, filename);
        await workbook.xlsx.writeFile(outPath);

        return { ok: true, filename, fileUrl: `/exports/${filename}` };
    },
} as any);
