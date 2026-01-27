# AI Agentic Docs (RAG + SQL Dictionary)

An advanced AI-powered documentation and database assistant built with Next.js, Vercel AI SDK, and PostgreSQL (pgvector). This project demonstrates a **hybrid agentic architecture** capable of answering complex queries by retrieving information from both written documentation and database schemas.

![System Architecture](./system-architecture.jpg)

## 🌟 Key Features

### 1. Dual-Mode AI Core
- **Agentic Mode (Advanced)**: A fully autonomous loop (`lib/agent`) that plans, executes tools, reflects, and re-plans. Supports **Human-in-the-loop** for tool approvals.
- **Simple Mode (Speed)**: A lightweight RAG pipeline for fast, factual answers.

### 2. Advanced Retrieval (RAG)
- **Documentation**: Ingests `.mdx` files into vector chunks.
- **Data Dictionary**: Introspects the SQL database schema to create a semantic dictionary of tables and columns, allowing the AI to understand and query your data structure.

### 3. Modern Interactive UI (`Ask AI`)
- **Streaming Responses**: Real-time token streaming with the Vercel AI SDK.
- **Process Visualization**: See the agent's "Thinking" process, active steps, and tool executions.
- **Rich Citations**: Direct links to source documents and database schema references.

## 🛠️ Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **AI**: Vercel AI SDK (Core + React), OpenAI
- **Database**: PostgreSQL + `pgvector` extension
- **Styling**: Tailwind CSS, Lucide React

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Recommended: 20)
- PostgreSQL 15+ with `pgvector` extension installed.

### 1. Setup Database
Create a database named `docs_ai` and run the schema script:
```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and configure your keys (OpenAI, Database URL):
```bash
cp .env.example .env.local
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Ingest Data
Run the ingestion scripts to populate your vector database:

**Ingest Documentation (MDX -> Vector):**
```bash
npm run ingest:docs
```

**Ingest Data Dictionary (Schema -> Vector):**
```bash
npm run ingest:dict
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000/docs/getting-started](http://localhost:3000/docs/getting-started).

## 📚 Documentation
- [System Features](content/docs/system-features.mdx) - Detailed breakdown of Agentic AI, RAG, and UI features.
- [System Architecture](content/docs/system-architecture.mdx) - Diagrams and architectural deep dive.

## 📂 Project Structure
- `lib/agent`: Core agent logic (Planner, Loop, Tools).
- `scripts`: Ingestion scripts for docs and DB dictionary.
- `components/ask-ai-chat.tsx`: Main chat interface.
- `content/docs`: MDX documentation source.
