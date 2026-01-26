import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/user";
import { getConversation, getMessages, deleteConversation } from "@/lib/memory";

const USER_COOKIE_NAME = "user_code";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id] - Get conversation with messages
 */
export async function GET(request: Request, { params }: RouteParams) {
    const { id } = await params;
    const cookieStore = await cookies();
    const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;

    if (!userCode) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getOrCreateUser(userCode);
    const conversation = await getConversation(id);

    if (!conversation) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify ownership
    if (conversation.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messages = await getMessages(id, 100);

    return NextResponse.json({
        conversation,
        messages,
    });
}

/**
 * DELETE /api/conversations/[id] - Delete a conversation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
    const { id } = await params;
    const cookieStore = await cookies();
    const userCode = cookieStore.get(USER_COOKIE_NAME)?.value;

    if (!userCode) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getOrCreateUser(userCode);
    const conversation = await getConversation(id);

    if (!conversation) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Verify ownership
    if (conversation.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteConversation(id);

    return NextResponse.json({ success: true });
}
