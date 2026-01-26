import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import type {
    Conversation,
    Message,
    CreateMessageInput,
    MemoryFact,
    CreateFactInput,
} from "./types";

// =====================================================
// CONVERSATION MANAGEMENT
// =====================================================

/**
 * Create a new conversation
 */
export async function createConversation(
    userId: string,
    title?: string
): Promise<Conversation> {
    const id = createId();
    const [conv] = await db<Conversation[]>`
    INSERT INTO conversations (id, user_id, title)
    VALUES (${id}, ${userId}, ${title ?? null})
    RETURNING id, user_id as "userId", title, 
              created_at as "createdAt", updated_at as "updatedAt"
  `;
    return conv;
}

/**
 * Get conversation by ID
 */
export async function getConversation(id: string): Promise<Conversation | null> {
    const [conv] = await db<Conversation[]>`
    SELECT id, user_id as "userId", title, 
           created_at as "createdAt", updated_at as "updatedAt"
    FROM conversations WHERE id = ${id}
  `;
    return conv || null;
}

/**
 * List conversations for a user
 */
export async function listConversations(
    userId: string,
    limit = 20
): Promise<Conversation[]> {
    return db<Conversation[]>`
    SELECT id, user_id as "userId", title, 
           created_at as "createdAt", updated_at as "updatedAt"
    FROM conversations 
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
    id: string,
    title: string
): Promise<Conversation | null> {
    const [conv] = await db<Conversation[]>`
    UPDATE conversations 
    SET title = ${title}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, user_id as "userId", title, 
              created_at as "createdAt", updated_at as "updatedAt"
  `;
    return conv || null;
}

/**
 * Delete conversation
 */
export async function deleteConversation(id: string): Promise<boolean> {
    const result = await db`DELETE FROM conversations WHERE id = ${id}`;
    return result.count > 0;
}

// =====================================================
// MESSAGE MANAGEMENT
// =====================================================

/**
 * Add a message to a conversation
 */
export async function addMessage(
    conversationId: string,
    input: CreateMessageInput
): Promise<Message> {
    // Update conversation's updated_at
    await db`UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}`;

    const [msg] = await db<Message[]>`
    INSERT INTO conversation_messages 
      (conversation_id, role, content, tool_name, tool_input, tool_output)
    VALUES (
      ${conversationId}, 
      ${input.role}, 
      ${input.content},
      ${input.toolName ?? null},
      ${input.toolInput ? JSON.stringify(input.toolInput) : null},
      ${input.toolOutput ? JSON.stringify(input.toolOutput) : null}
    )
    RETURNING id, conversation_id as "conversationId", role, content,
              tool_name as "toolName", tool_input as "toolInput", 
              tool_output as "toolOutput", created_at as "createdAt"
  `;
    return msg;
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
    conversationId: string,
    limit = 50
): Promise<Message[]> {
    return db<Message[]>`
    SELECT id, conversation_id as "conversationId", role, content,
           tool_name as "toolName", tool_input as "toolInput", 
           tool_output as "toolOutput", created_at as "createdAt"
    FROM conversation_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
}

/**
 * Get recent messages across all conversations for a user
 */
export async function getRecentUserMessages(
    userId: string,
    limit = 20
): Promise<Message[]> {
    return db<Message[]>`
    SELECT m.id, m.conversation_id as "conversationId", m.role, m.content,
           m.tool_name as "toolName", m.tool_input as "toolInput", 
           m.tool_output as "toolOutput", m.created_at as "createdAt"
    FROM conversation_messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.user_id = ${userId}
    ORDER BY m.created_at DESC
    LIMIT ${limit}
  `;
}

// =====================================================
// MEMORY FACTS
// =====================================================

/**
 * Create a memory fact
 */
export async function createFact(input: CreateFactInput): Promise<MemoryFact> {
    const [fact] = await db<MemoryFact[]>`
    INSERT INTO memory_facts 
      (conversation_id, user_id, fact_type, content, embedding, importance, expires_at)
    VALUES (
      ${input.conversationId ?? null},
      ${input.userId},
      ${input.factType},
      ${input.content},
      ${input.embedding ? JSON.stringify(input.embedding) : null}::vector,
      ${input.importance ?? 0.5},
      ${input.expiresAt ?? null}
    )
    RETURNING id, conversation_id as "conversationId", user_id as "userId",
              fact_type as "factType", content, importance,
              created_at as "createdAt", expires_at as "expiresAt"
  `;
    return fact;
}

/**
 * Get facts for a user
 */
export async function getUserFacts(
    userId: string,
    limit = 20
): Promise<MemoryFact[]> {
    return db<MemoryFact[]>`
    SELECT id, conversation_id as "conversationId", user_id as "userId",
           fact_type as "factType", content, importance,
           created_at as "createdAt", expires_at as "expiresAt"
    FROM memory_facts
    WHERE user_id = ${userId}
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY importance DESC, created_at DESC
    LIMIT ${limit}
  `;
}

/**
 * Search facts by semantic similarity
 */
export async function searchFacts(
    userId: string,
    queryEmbedding: number[],
    limit = 5
): Promise<MemoryFact[]> {
    return db<MemoryFact[]>`
    SELECT id, conversation_id as "conversationId", user_id as "userId",
           fact_type as "factType", content, importance,
           created_at as "createdAt", expires_at as "expiresAt"
    FROM memory_facts
    WHERE user_id = ${userId}
      AND embedding IS NOT NULL
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `;
}

/**
 * Delete expired facts
 */
export async function cleanupExpiredFacts(): Promise<number> {
    const result = await db`
    DELETE FROM memory_facts WHERE expires_at < now()
  `;
    return result.count;
}
