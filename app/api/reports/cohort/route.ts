import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { buildCohortWorkbookTool } from "@/lib/tools/analytics/report-composer";

const USER_COOKIE_NAME = "user_code";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const body = await req.json();
  const { dateFrom, dateTo, maxMonths = 12, branchIds = null, conversationId = null } = body;

  const result = await (buildCohortWorkbookTool as any).execute({
    userId: user.id,
    conversationId,
    dateFrom,
    dateTo,
    maxMonths,
    branchIds: branchIds || undefined,
  });

  return NextResponse.json(result);
}
