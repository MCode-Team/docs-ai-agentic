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
