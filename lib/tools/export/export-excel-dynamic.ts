import { tool } from "ai";
import { z } from "zod";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";

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

const ConditionalRuleSchema = z.object({
    sheet: z.string(),
    column: z.string(),
    operator: z.enum(["<", ">", "<=", ">=", "==", "!=", "contains", "gt", "lt"]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    // For backward compatibility (old schema had threshold/type)
    threshold: z.number().optional(),
    type: z.enum(["gt", "lt"]).optional(),

    style: z.object({
        fillColor: z.string().optional(),
        fontColor: z.string().optional(),
        bold: z.boolean().optional(),
    }).optional(),
    // For backward compatibility
    fill: z.string().optional(),
});

export const exportExcelDynamicTool = tool({
    description:
        "Export Excel with dynamic sheets, styles, and conditional formatting. Supports inferred columns from data.",
    parameters: z.object({
        filename: z.string().default("export.xlsx"),
        sheets: z.array(SheetSchema).min(1),
        styles: z.object({
            defaultHeader: z.any().optional(),
            bodyFont: z.object({
                name: z.string().optional(),
                size: z.number().optional()
            }).optional(),
            // Allow other keys
        }).catchall(z.any()).optional(),
        conditionalRules: z.array(ConditionalRuleSchema).optional().default([]),
    }),
    execute: async ({ filename, sheets, styles, conditionalRules }: { filename: string; sheets: any[]; styles?: any; conditionalRules: any[] }) => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Ask AI";
        workbook.created = new Date();

        // Default styles
        const defaultHeaderStyle = styles?.defaultHeader || {
            bold: true,
            backgroundColor: "#F2F2F2", // default grey
        };

        // Default Body Font (Good for Thai: Sarabun, Tahoma, Angsana New, or just Arial)
        const bodyFont = styles?.bodyFont || { name: "Arial", size: 11 };

        // Helper to get global format for a column if defined in styles
        const getColumnFormat = (colKey: string) => {
            if (!styles) return null;
            for (const key in styles) {
                const styleDef = styles[key];
                if (styleDef.columns && Array.isArray(styleDef.columns) && styleDef.columns.includes(colKey)) {
                    return styleDef.format;
                }
            }
            return null;
        };

        for (const sheet of sheets) {
            const ws = workbook.addWorksheet(sheet.name);

            let columns = sheet.columns;
            const rows = sheet.rows || [];

            // Infer columns from rows if not provided
            if (!columns || columns.length === 0) {
                if (rows.length > 0) {
                    const keys = new Set<string>();
                    rows.forEach((r: any) => Object.keys(r).forEach((k) => keys.add(k)));
                    columns = Array.from(keys).map((k) => ({
                        key: k,
                        header: k.charAt(0).toUpperCase() + k.slice(1),
                        width: 15,
                    }));
                } else {
                    // Fallback columns if no data
                    columns = [{ key: "note", header: "Note", width: 50 }];
                    rows.push({ note: "No data provided for this sheet." });
                }
            }

            // Map columns and apply formats
            ws.columns = columns.map((c: any) => {
                const fmt = c.numFmt || getColumnFormat(c.key);
                return {
                    key: c.key,
                    header: c.header || c.key,
                    width: c.width ?? 15,
                    style: {
                        font: bodyFont,
                        numFmt: fmt || undefined
                    },
                };
            });

            // Style Header
            const headerRow = ws.getRow(1);
            headerRow.height = 20;

            headerRow.eachCell((cell) => {
                if (defaultHeaderStyle.bold) cell.font = { bold: true };

                let bgColor = defaultHeaderStyle.backgroundColor;
                // Handle hex without # if happened
                if (bgColor && !bgColor.startsWith("#") && /^[0-9A-Fa-f]{6}$/.test(bgColor)) {
                    bgColor = "FF" + bgColor; // ARGB
                } else if (bgColor && bgColor.startsWith("#")) {
                    bgColor = "FF" + bgColor.substring(1);
                }

                if (bgColor) {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: bgColor },
                    };
                }

                cell.alignment = { vertical: "middle", horizontal: "center" };
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });

            // Add Data
            for (const r of rows) {
                ws.addRow(r);
            }

            // Auto-filter (if requested or default)
            // Check if legacy styles.autoFilter or just default on
            ws.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: columns.length },
            };
        }

        // Apply Conditional Rules
        for (const rule of conditionalRules || []) {
            const ws = workbook.getWorksheet(rule.sheet);
            if (!ws) continue;

            const colKey = rule.column || rule.columnKey; // rule.columnKey is legacy
            const colIndex = ws.columns.findIndex((c) => c.key === colKey);
            if (colIndex === -1) continue;

            const excelCol = colIndex + 1;

            // Parse Threshold/Value
            let threshold = rule.value;
            if (threshold === undefined) threshold = rule.threshold; // legacy

            let operator = rule.operator;
            if (!operator && rule.type) {
                if (rule.type === 'gt') operator = '>';
                if (rule.type === 'lt') operator = '<';
            }

            // Parse Style
            let userFill = rule.style?.fillColor || rule.style?.backgroundColor || rule.fill;
            if (userFill && userFill.startsWith("#")) userFill = "FF" + userFill.substring(1);

            for (let i = 2; i <= ws.rowCount; i++) {
                const cell = ws.getRow(i).getCell(excelCol);
                const cellValue = cell.value;
                const numVal = Number(cellValue);

                // Simple comparison logic
                let match = false;

                if (operator === '<' && !isNaN(numVal) && numVal < Number(threshold)) match = true;
                if (operator === '>' && !isNaN(numVal) && numVal > Number(threshold)) match = true;
                if (operator === '<=' && !isNaN(numVal) && numVal <= Number(threshold)) match = true;
                if (operator === '>=' && !isNaN(numVal) && numVal >= Number(threshold)) match = true;
                if (operator === '==' && cellValue == threshold) match = true;

                if (match && userFill) {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: userFill } };
                }
            }
        }

        // Write file
        const outDir = path.join(process.cwd(), process.env.EXPORT_PUBLIC_DIR || "public/exports");
        try {
            await fs.mkdir(outDir, { recursive: true });
        } catch (e) { }

        const outPath = path.join(outDir, filename);
        await workbook.xlsx.writeFile(outPath);

        return { ok: true, filename, fileUrl: `/exports/${filename}`, summary: `Generated ${filename} with ${sheets.length} sheets.` };
    },
} as any);
