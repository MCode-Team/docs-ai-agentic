
import { getOrdersTool } from "../lib/tools/fixed/get-orders";
import { executeCodeTool } from "../lib/tools/sandbox/execute-code";

async function runAnalysis() {
    console.log("Fetching orders from 2026-01-01 to 2026-02-01...");
    try {
        // 1. Fetch Orders (Limit to 500 to safe handling in prompt/params)
        // @ts-ignore
        const orders = await getOrdersTool.execute({
            dateFrom: "2026-01-01",
            dateTo: "2026-02-01",
            limit: 500
        }, { toolCallId: 'test', messages: [] } as any) as any[];

        console.log(`Fetched ${orders.length} orders.`);
        if (orders.length === 0) {
            console.log("No orders found.");
            return;
        }

        // 2. Process with executeCode (Pandas)
        // We inject the data directly into the python script.
        const pythonCode = `
import pandas as pd
import json

data = ${JSON.stringify(orders)}
df = pd.DataFrame(data)

# Ensure numeric types
df['order_amount'] = pd.to_numeric(df['order_amount'])

print("--- Summary by Branch ---")
branch_group = df.groupby('branch_id')['order_amount'].sum().sort_values(ascending=False)
print(branch_group.to_string())

print("\\n--- Summary by Channel ---")
channel_group = df.groupby('channel')['order_amount'].sum().sort_values(ascending=False)
print(channel_group.to_string())
`;

        console.log("Executing Python analysis...");
        // @ts-ignore - Mocking context for direct tool execution
        const result = await executeCodeTool.execute({
            code: pythonCode,
            timeout: 30
        }, { toolCallId: 'test', messages: [] } as any) as any;

        if (result.success) {
            console.log("\nAnalysis Output:\n");
            console.log(result.output);
        } else {
            console.error("Execution failed:", result.error);
            console.error("Output:", result.output);
        }

    } catch (error) {
        console.error("Analysis failed:", error);
    }
}

runAnalysis();
