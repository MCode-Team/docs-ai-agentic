import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { listConversations, createConversation } from "@/lib/memory";
import { getMessages } from "@/lib/memory";

const USER_COOKIE_NAME = "user_code";

/**
 * GET /api/conversations - List user's conversations
 */
export async function GET() {
    const cookieStore = await cookies();
    const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;

    if (!userCode) {
        return NextResponse.json({ conversations: [] });
    }

    const user = await getOrCreateUser(userCode);
    const conversations = await listConversations(user.id, 50);

    return NextResponse.json({ conversations });
}

/**
 * POST /api/conversations - Create a new conversation
 */
export async function POST() {
    const cookieStore = await cookies();
    let userCode = cookieStore.get(USER_COOKIE_NAME)?.value;

    // Get or create user
    const user = await getOrCreateUser(userCode);

    // Set cookie if new user
    if (!userCode) {
        const response = NextResponse.json({ conversationId: null });
        response.cookies.set(USER_COOKIE_NAME, user.userCode, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365, // 1 year
        });
        userCode = user.userCode;
    }

    const conversation = await createConversation(user.id);

    return NextResponse.json({
        conversationId: conversation.id,
        userId: user.id,
        userCode: user.userCode,
    });
}
