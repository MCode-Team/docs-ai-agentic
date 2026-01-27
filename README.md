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

## 🐳 Containerized Setup (Docker)

For a complete local environment including the Reranker and Code Sandbox, use Docker Compose.

```bash
docker-compose up -d --build
```

### Services Included:
### Services Included:

1.  **Web App** (Port `3000`)
    *   **Role**: The main application interface and API backend.
    *   **Relevance**: Hosts the "Ask AI" chat UI, manages the Agentic Loop, handles RAG logic, and connects all other services together. Built with Next.js 15.

2.  **Database** (Port `5432`)
    *   **Role**: PostgreSQL database with `pgvector` extension.
    *   **Relevance**: Acts as the system's long-term memory. It stores:
        *   Vector embeddings for documentation and schema definitions (enabling semantic search).
        *   Application data and conversation history.

3.  **Zerank** (Port `8787`)
    *   **Role**: A self-hosted Reranking API using the `zeroentropy/zerank-2` model.
    *   **Relevance**: Drastically improves answer quality. After the database retrieves rough search results, Zerank re-scores them to ensure the AI only sees the *most* relevant context, reducing hallucinations.

4.  **Sandbox** (Port `8000`)
    *   **Role**: A secure, isolated Python & Bash execution environment.
    *   **Relevance**: Gives the Agent "Hands". It allows the AI to safely:
        *   Execute Python code for complex calculations or data analysis.
        *   Run bash scripts to interact with the file system or environment.
        *   Verify code snippets before showing them to the user.

> [!NOTE]
> Ensure you have `HUGGING_FACE_HUB_TOKEN` set in your `.env.local` if using gated models for Zerank.

## 📚 Documentation
- [System Features](content/docs/system-features.mdx) - Detailed breakdown of Agentic AI, RAG, and UI features.
- [System Architecture](content/docs/system-architecture.mdx) - Diagrams and architectural deep dive.

## 📂 Project Structure
- `lib/agent`: Core agent logic (Planner, Loop, Tools).
- `scripts`: Ingestion scripts for docs and DB dictionary.
- `components/ask-ai-chat.tsx`: Main chat interface.
- `content/docs`: MDX documentation source.
