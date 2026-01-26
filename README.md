# Docs + Ask AI (pgvector + dictionary + tools + excel export)

## Prerequisites
- Node.js 18+ (แนะนำ 20)
- Postgres 15+ และติดตั้ง extension `pgvector`

## 1) ตั้งค่า Database
สร้างฐานข้อมูลชื่อ `docs_ai` แล้วรันไฟล์:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

## 2) ตั้งค่า env
คัดลอก `.env.example` ไปเป็น `.env.local` แล้วใส่ค่า

## 3) Install
```bash
npm install
```

## 4) Ingest เอกสาร (MDX -> docs_chunks)
```bash
npm run ingest:docs
```

## 5) Ingest Data Dictionary (Schema/Columns -> db_dictionary_chunks)
```bash
npm run ingest:dict
```

## 6) Run
```bash
npm run dev
```

เปิด:
- http://localhost:3000/docs/getting-started
