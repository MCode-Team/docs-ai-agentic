import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { getCoreFiles } from "@/lib/profile";

const USER_COOKIE_NAME = "user_code";

export async function GET() {
  const cookieStore = await cookies();
  const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;
  const user = await getOrCreateUser(userCode);

  const core = await getCoreFiles(user.id);
  return NextResponse.json({
    ok: true,
    user: { id: user.id, userCode: user.userCode },
    coreFiles: {
      IDENTITY: core.IDENTITY,
      USER: core.USER,
      SOUL: core.SOUL,
      MEMORY: core.MEMORY,
    },
  });
}
