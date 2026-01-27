CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS docs_chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  heading TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS docs_chunks_embedding_idx
ON docs_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE TABLE IF NOT EXISTS db_dictionary_chunks (
  id BIGSERIAL PRIMARY KEY,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS db_dictionary_embedding_idx
ON db_dictionary_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE SCHEMA IF NOT EXISTS sale_order;

CREATE TABLE IF NOT EXISTS sale_order.orders (
  id BIGSERIAL PRIMARY KEY,
  order_code TEXT,
  order_status INT,
  order_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE sale_order.orders IS 'ตารางคำสั่งซื้อหลักของระบบ';
COMMENT ON COLUMN sale_order.orders.order_code IS 'รหัสคำสั่งซื้อ';
COMMENT ON COLUMN sale_order.orders.order_status IS 'สถานะคำสั่งซื้อ (int code)';
COMMENT ON COLUMN sale_order.orders.order_amount IS 'ยอดรวมสุทธิของคำสั่งซื้อ (บาท)';

-- =====================================================
-- AGENTIC MEMORY TABLES
-- =====================================================

-- Anonymous users with profile
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,  -- CUID generated in app
  user_code TEXT UNIQUE NOT NULL,  -- auto-generated or custom code
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_code ON users(user_code);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'th',           -- 'th' | 'en'
  response_tone TEXT DEFAULT 'friendly', -- 'friendly' | 'formal' | 'concise'
  auto_approve_tools TEXT[] DEFAULT '{}', -- tools to auto-approve
  custom_instructions TEXT,              -- custom system prompt
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Conversation sessions
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,  -- CUID generated in app
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

-- Message history
CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system' | 'tool'
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_input JSONB,
  tool_output JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);

-- Long-term memory facts
CREATE TABLE IF NOT EXISTS memory_facts (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL,  -- 'preference' | 'context' | 'entity' | 'summary'
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  importance FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ  -- optional TTL
);

CREATE INDEX IF NOT EXISTS idx_facts_user ON memory_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_facts_embedding ON memory_facts
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Tool approvals for pending tool calls
CREATE TABLE IF NOT EXISTS tool_approvals (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  input JSONB,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'executed'
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_approvals_status ON tool_approvals(status);

