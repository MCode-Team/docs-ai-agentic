import { NextResponse } from "next/server";
import { queryAggregateTool } from "@/lib/tools/analytics";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { dateFrom, dateTo, filters = null } = body;

  const sales = await (queryAggregateTool as any).execute({
    dataset: "sales_lines",
    dateFrom,
    dateTo,
    groupBy: [],
    metrics: ["qty", "net_sales", "cost", "gross_profit"],
    filters,
    limit: 1,
    orderBy: { field: "net_sales", direction: "desc" },
  });

  const orders = await (queryAggregateTool as any).execute({
    dataset: "orders",
    dateFrom,
    dateTo,
    groupBy: [],
    metrics: ["order_count", "customer_count"],
    filters,
    limit: 1,
    orderBy: { field: "order_count", direction: "desc" },
  });

  const s0 = sales.rows?.[0] || {};
  const o0 = orders.rows?.[0] || {};

  return NextResponse.json({
    ok: true,
    summary: {
      qty: Number(s0.qty || 0),
      net_sales: Number(s0.net_sales || 0),
      cost: Number(s0.cost || 0),
      gross_profit: Number(s0.gross_profit || 0),
      order_count: Number(o0.order_count || 0),
      customer_count: Number(o0.customer_count || 0),
      gp_margin: Number(s0.net_sales || 0) ? Number(s0.gross_profit || 0) / Number(s0.net_sales || 1) : 0,
    },
  });
}
