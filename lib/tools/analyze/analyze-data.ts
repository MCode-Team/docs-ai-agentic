import { tool } from "ai";
import { z } from "zod";
import * as dfd from "danfojs";

export const analyzeDataTool = tool({
    description: "วิเคราะห์ข้อมูลแบบ pandas: groupby / sum / mean / sort / topN",
    parameters: z.object({
        rows: z.array(z.record(z.string(), z.any())),
        groupBy: z.string().optional(),
        sumField: z.string().optional(),
        topN: z.number().optional().default(20),
    }),
    execute: async ({ rows, groupBy, sumField, topN }: { rows: any[]; groupBy?: string; sumField?: string; topN: number }) => {
        const df = new dfd.DataFrame(rows);

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
