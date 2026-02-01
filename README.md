# AI Agentic Docs (RAG + SQL Dictionary)

[🇹🇭 ภาษาไทย (Thai)](./README.md) | [🇬🇧 English](./README_EN.md)

ผู้ช่วยอัจฉริยะเพื่อการจัดการเอกสารและฐานข้อมูล (AI-powered documentation and database assistant) ที่พัฒนาด้วย Next.js, Vercel AI SDK และ PostgreSQL (pgvector) โปรเจคนี้แสดงให้เห็นถึง **สถาปัตยกรรม Agentic แบบลูกผสม (Hybrid Agentic Architecture)** ที่สามารถตอบคำถามซับซ้อนโดยการดึงข้อมูลจากทั้งเอกสารและโครงสร้างฐานข้อมูล (Database Schema)

![System Architecture](./Al-Agentic-Docs.png)

## 🎥 Watch the Video
[![Demo](https://img.youtube.com/vi/SzqdP7sjykY/0.jpg)](https://www.youtube.com/watch?v=SzqdP7sjykY)

## 🌟 ฟีเจอร์หลัก (Key Features)

### 1. Dual-Mode AI Core (ระบบ AI สองโหมด)
- **Agentic Mode (ขั้นสูง)**: ลูปการทำงานอัตโนมัติ (`lib/agent`) ที่สามารถวางแผน (Plan), เรียกใช้เครื่องมือ (Execute Tools), ตรวจสอบผลลัพธ์ (Reflect), และวางแผนใหม่ (Re-plan) ได้เอง รองรับ **Human-in-the-loop** สำหรับการรออนุมัติจากผู้ใช้
- **Simple Mode (เน้นความเร็ว)**: ระบบ RAG แบบพื้นฐานสำหรับคำตอบที่ต้องการความรวดเร็วและเน้นข้อเท็จจริง

### 2. Advanced Retrieval (ระบบค้นหาข้อมูลขั้นสูง / RAG)
- **Documentation**: นำเข้าไฟล์ `.mdx` แปลงเป็น vector chunks
- **Data Dictionary**: อ่านโครงสร้างฐานข้อมูล SQL (Schema Introspection) เพื่อสร้าง "พจนานุกรมข้อมูล" อธิบายความหมายของตารางและคอลัมน์ ช่วยให้ AI เข้าใจและ query โครงสร้างข้อมูลของคุณได้แม่นยำ

### 3. Modern Interactive UI (`Ask AI`)
- **Streaming Responses**: แสดงผลลัพธ์แบบ Streaming Real-time ด้วย Vercel AI SDK
- **Process Visualization**: แสดงกระบวนการ "คิด" (Thinking), ขั้นตอนการทำงาน, และการเรียกใช้ Tools ของ Agent ให้ผู้ใช้เห็นภาพ
- **Rich Citations**: มีลิงก์อ้างอิงกลับไปยังเอกสารต้นทางและ Data Dictionary ที่ถูกใช้งานในการตอบคำถาม

### 4. Bootstrap / Trigger Prompt (ย้ายบริบทส่วนตัวแบบครั้งเดียว)
เพิ่ม endpoint สำหรับแนวคิด “Trigger Prompt” เพื่อดึงข้อมูลจาก AI ตัวเดิมที่คุยกับคุณมานาน แล้ว import เข้า memory ของระบบนี้ได้ทันที
- `GET /api/bootstrap?lang=th|en` → ได้ prompt template
- `POST /api/bootstrap` → ส่ง JSON ที่ได้จาก AI ตัวเดิม เพื่อ import เป็น `memory_facts` + `user_preferences`

## 🛠️ Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **AI**: Vercel AI SDK (Core + React), OpenAI
- **Database**: PostgreSQL + `pgvector` extension
- **Styling**: Tailwind CSS, Lucide React

## 🚀 การเริ่มต้นใช้งาน (Getting Started)

### Prerequisites (สิ่งที่ต้องมี)
- Node.js 18+ (แนะนำรุ่น 20)
- PostgreSQL 15+ ที่ติดตั้ง `pgvector` extension แล้ว

### 1. Setup Database
สร้างฐานข้อมูลชื่อ `docs_ai` และรันสคริปต์ schema:

เราสามารถใช้งานคำสั่ง `db:init` เพื่อสร้าง table พื้นฐานได้ทันที:
```bash
npm run db:init
```

หรือรันผ่าน `psql` โดยตรง:
```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

### 2. Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env.local` และตั้งค่าคีย์ต่างๆ (OpenAI, Database URL):
```bash
cp .env.example .env.local
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Ingest Data (นำเข้าข้อมูล)
รันสคริปต์เพื่อนำข้อมูลเข้าสู่ Vector Database:

**นำเข้าเอกสาร (MDX -> Vector):**
```bash
npm run ingest:docs
```

**นำเข้า Data Dictionary (Schema -> Vector):**
```bash
npm run ingest:dict
```

### 5. Run Development Server
```bash
npm run dev
```
เปิด [http://localhost:3000/docs/getting-started](http://localhost:3000/docs/getting-started)

## 🐳 Containerized Setup (Docker)

สำหรับการรันระบบเต็มรูปแบบ (Full Stack) รวมถึง Reranker และ Code Sandbox ให้ใช้ Docker Compose

```bash
docker-compose up -d --build
```

### Services Included (บริการที่รวมอยู่ใน Docker):

1.  **Web App** (Port `3000`)
    *   **Role**: ส่วนติดต่อผู้ใช้หลักและ API Backend
    *   **Relevance**: ให้บริการหน้าจอ "Ask AI Chat", จัดการระบบ Agentic Loop, ดูแล logic ของ RAG และเชื่อมต่อบริการอื่นๆ เข้าด้วยกัน พัฒนาด้วย Next.js 15

2.  **Database** (Port `5432`)
    *   **Role**: ฐานข้อมูล PostgreSQL พร้อม `pgvector` extension
    *   **Relevance**: ทำหน้าที่เป็น "ความจำระยะยาว" (Long-term memory) ของระบบ จัดเก็บ:
        *   Vector embeddings ของเอกสารและ Schema (สำหรับการค้นหาเชิงความหมาย)
        *   ข้อมูลของแอปพลิเคชันและประวัติการสนทนา

3.  **Zerank** (Port `8787`)
    *   **Role**: API สำหรับการจัดอันดับข้อมูล (Reranking) แบบ self-hosted โดยใช้โมเดล `zeroentropy/zerank-2`
    *   **Relevance**: ช่วยปรับปรุงคุณภาพคำตอบอย่างมาก! หลังจากฐานข้อมูลค้นหาข้อมูลดิบมาแล้ว Zerank จะให้คะแนนความเกี่ยวข้องใหม่ เพื่อให้แน่ใจว่า AI จะได้รับข้อมูลบริบทที่ *ตรงจุด* เท่านั้น ช่วยลดอาการหลอน (Hallucinations) ของ AI

4.  **Sandbox** (Port `8000`)
    *   **Role**: สภาพแวดล้อมที่ปลอดภัยและแยกส่วน (Isolated) สำหรับรัน Python และ Bash
    *   **Relevance**: เปรียบเสมือน "มือ" ของ Agent ช่วยให้ AI สามารถ:
        *   รันโค้ด Python เพื่อคำนวณซับซ้อนหรือวิเคราะห์ข้อมูล
        *   รันคำสั่ง Bash เพื่อจัดการไฟล์หรือระบบ
        *   ตรวจสอบความถูกต้องของโค้ดก่อนแสดงให้ผู้ใช้เห็น

> [!NOTE]
> ตรวจสอบให้แน่ใจว่าคุณได้ตั้งค่า `HUGGING_FACE_HUB_TOKEN` ในไฟล์ `.env.local` หากคุณใช้โมเดลของ Zerank ที่ต้องมีการยืนยันตัวตน (Gated models)

## 📚 Documentation
- [System Features](content/docs/system-features.mdx) - รายละเอียดฟีเจอร์ของระบบ Agentic AI, RAG, และ UI
- [System Architecture](content/docs/system-architecture.mdx) - แผนภาพและรายละเอียดเชิงลึกของสถาปัตยกรรม (System Architecture Diagram)

## 📂 Project Structure
- `lib/agent`: Logic หลักของ Agent (Planner, Loop, Tools)
- `scripts`: สคริปต์สำหรับนำเข้าข้อมูล (Ingestion) สำหรับ Docs และ DB Dictionary
- `components/ask-ai-chat.tsx`: หน้าจอแชทหลัก
- `content/docs`: ต้นฉบับเอกสาร MDX
