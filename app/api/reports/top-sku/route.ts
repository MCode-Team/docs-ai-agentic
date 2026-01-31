import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { buildTopSkuWorkbookTool } from "@/lib/tools/analytics/report-composer";

const USER_COOKIE_NAME = "user_code";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const body = await req.json();
  const { dateFrom, dateTo, topN = 50, filters = null, conversationId = null } = body;

  const result = await (buildTopSkuWorkbookTool as any).execute({
    userId: user.id,
    conversationId,
    dateFrom,
    dateTo,
    topN,
    filters,
  });

  return NextResponse.json(result);
}
