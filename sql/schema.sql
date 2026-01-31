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

-- =====================================================
-- ANALYTICS (Orders / Sales Lines / Inventory)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- Master data
CREATE TABLE IF NOT EXISTS analytics.branches (
  branch_id TEXT PRIMARY KEY,
  branch_code TEXT,
  branch_name TEXT,
  province TEXT,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics.product_categories (
  category_id TEXT PRIMARY KEY,
  category_name TEXT NOT NULL,
  parent_category_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics.products (
  sku TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand_name TEXT,
  category_id TEXT REFERENCES analytics.product_categories(category_id),
  uom TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders (header)
CREATE TABLE IF NOT EXISTS analytics.orders (
  order_id BIGSERIAL PRIMARY KEY,
  order_code TEXT UNIQUE,
  order_datetime TIMESTAMPTZ NOT NULL,
  branch_id TEXT REFERENCES analytics.branches(branch_id),
  customer_id TEXT,
  order_status TEXT,
  channel TEXT,
  net_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_orders_dt ON analytics.orders(order_datetime);
CREATE INDEX IF NOT EXISTS idx_analytics_orders_branch_dt ON analytics.orders(branch_id, order_datetime);
CREATE INDEX IF NOT EXISTS idx_analytics_orders_customer_dt ON analytics.orders(customer_id, order_datetime);

-- Sales lines (denormalized for fast analytics)
CREATE TABLE IF NOT EXISTS analytics.sales_lines (
  line_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES analytics.orders(order_id) ON DELETE CASCADE,
  order_datetime TIMESTAMPTZ NOT NULL,
  branch_id TEXT REFERENCES analytics.branches(branch_id),
  customer_id TEXT,
  sku TEXT REFERENCES analytics.products(sku),
  qty NUMERIC NOT NULL DEFAULT 0,
  net_sales NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_sales_lines_dt ON analytics.sales_lines(order_datetime);
CREATE INDEX IF NOT EXISTS idx_analytics_sales_lines_sku_dt ON analytics.sales_lines(sku, order_datetime);
CREATE INDEX IF NOT EXISTS idx_analytics_sales_lines_branch_sku_dt ON analytics.sales_lines(branch_id, sku, order_datetime);
CREATE INDEX IF NOT EXISTS idx_analytics_sales_lines_customer_dt ON analytics.sales_lines(customer_id, order_datetime);

-- Inventory (real-time current)
CREATE TABLE IF NOT EXISTS analytics.inventory_current (
  branch_id TEXT REFERENCES analytics.branches(branch_id),
  sku TEXT REFERENCES analytics.products(sku),
  on_hand_qty NUMERIC NOT NULL DEFAULT 0,
  on_hand_value NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (branch_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_analytics_inventory_sku ON analytics.inventory_current(sku);

-- =====================================================
-- ARTIFACTS (Excel downloads with TTL)
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics.artifacts (
  id UUID PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_artifacts_expires ON analytics.artifacts(expires_at);

