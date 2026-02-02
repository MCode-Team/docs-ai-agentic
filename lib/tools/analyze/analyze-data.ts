import { tool } from "ai";
import { z } from "zod";

export const analyzeDataTool = tool({
    description: "วิเคราะห์ข้อมูลแบบ pandas: groupby / sum / mean / sort / topN",
    parameters: z.object({
        rows: z.array(z.record(z.string(), z.any())),
        groupBy: z.string().optional(),
        sumField: z.string().optional(),
        topN: z.number().optional().default(20),
    }),
    execute: async ({ rows, groupBy, sumField, topN }: { rows: any; groupBy?: string; sumField?: string; topN: number }) => {
        // Handle array-like objects (e.g., postgres.js Result)
        let dataRows: any[];
        if (Array.isArray(rows)) {
            dataRows = rows;
        } else if (rows && typeof rows === 'object') {
            // Try to convert array-like object to array
            if (typeof rows.length === 'number' || '0' in rows) {
                dataRows = Array.from(Object.values(rows).filter(v => typeof v === 'object' && v !== null));
            } else {
                return {
                    error: "Invalid data: 'rows' must be an array of objects.",
                    receivedType: typeof rows,
                    keys: Object.keys(rows).slice(0, 10)
                };
            }
        } else {
            return {
                error: "Invalid data: 'rows' must be an array of objects.",
                receivedType: typeof rows,
                rowsValue: rows ? "present" : "missing"
            };
        }

        if (dataRows.length === 0) {
            return { error: "No data rows to analyze", totalRows: 0 };
        }

        const dfd = await import("danfojs");
        const df = new dfd.DataFrame(dataRows);

        if (!groupBy || !sumField) {
            return {
                totalRows: df.shape[0],
                columns: df.columns,
                preview: df.head(10).toJSON(),
            };
        }

        const grouped = df.groupby([groupBy]).col([sumField]).sum();
        const sumCol = `${sumField}_sum`;
        const sorted = grouped.sortValues(sumCol, { ascending: false });

        return {
            totalRows: df.shape[0],
            result: sorted.head(topN).toJSON(),
        };
    },
} as any);
