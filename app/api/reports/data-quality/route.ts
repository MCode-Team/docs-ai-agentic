import { NextResponse } from "next/server";
import { dataQualityReportTool } from "@/lib/tools/analytics";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { days = 30 } = body;

  const result = await (dataQualityReportTool as any).execute({ days });
  return NextResponse.json(result);
}
