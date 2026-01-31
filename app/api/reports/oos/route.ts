import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { buildOosWorkbookTool } from "@/lib/tools/analytics/report-composer";

const USER_COOKIE_NAME = "user_code";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const body = await req.json();
  const { dateFrom, dateTo, topN = 100, branchIds = null, categoryIds = null, conversationId = null } = body;

  const result = await (buildOosWorkbookTool as any).execute({
    userId: user.id,
    conversationId,
    dateFrom,
    dateTo,
    topN,
    branchIds: branchIds || undefined,
    categoryIds: categoryIds || undefined,
  });

  return NextResponse.json(result);
}
