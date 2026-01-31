export type ExpertId = "router" | "docs" | "sql" | "ops" | "security" | "review";

export interface ExpertProfile {
  id: ExpertId;
  label: string;
  description: string;
  /** Injected into the planner prompt to steer strategy + style */
  plannerInstructions: string;
  /** Which tools the planner is allowed to call for this expert (empty = no tools) */
  allowedTools: string[];
}

export const EXPERTS: Record<ExpertId, ExpertProfile> = {
  router: {
    id: "router",
    label: "Router",
    description: "เลือกผู้เชี่ยวชาญที่เหมาะกับคำถามและกำหนดแนวทางการแก้ปัญหา",
    plannerInstructions:
      "คุณกำลังทำงานในบทบาท Router: เลือกแนวทางที่เหมาะสมที่สุดและถ้าจำเป็นให้ส่งต่อ (handoff) ไปยังผู้เชี่ยวชาญที่เหมาะสม (Docs/SQL/Ops/Security).",
    allowedTools: [],
  },
  docs: {
    id: "docs",
    label: "Docs Expert",
    description: "เชี่ยวชาญการตอบจากเอกสาร/คู่มือ/สถาปัตยกรรมระบบ โดยเน้นอ้างอิงและสรุปเป็นระบบ",
    plannerInstructions:
      "คุณคือ Docs Expert: ตอบโดยอ้างอิง Docs Context เป็นหลัก, สรุปเป็นหัวข้อ, ใส่ลิงก์/ที่มาเมื่อมี. หลีกเลี่ยงการเดาเมื่อไม่มีข้อมูลใน docs.",
    allowedTools: [],
  },
  sql: {
    id: "sql",
    label: "SQL Expert",
    description: "เชี่ยวชาญฐานข้อมูล/ดาต้าดิคชันนารี/การวิเคราะห์ข้อมูลและออกแบบ query",
    plannerInstructions:
      "คุณคือ SQL Expert: ใช้ DB Dictionary เพื่อตีความ schema, อธิบายตาราง/คอลัมน์ที่เกี่ยวข้อง, ถ้าต้องวิเคราะห์ให้ใช้เครื่องมือดึงข้อมูล/วิเคราะห์ก่อนตอบ. แนะนำ query/แนวทางตรวจสอบข้อมูลอย่างเป็นขั้นตอน.",
    allowedTools: [
      "getSalesSummary",
      "getOrderStatusCounts",
      "getOrders",
      "queryAggregate",
      "trendReport",
      "cohortReport",
      "oosReport",
      "exportExcelArtifact",
      "buildTopSkuWorkbook",
      "buildOosWorkbook",
      "buildCohortWorkbook",
      "analyzeData",
      "executeCode",
    ],
  },
  ops: {
    id: "ops",
    label: "Ops/DevOps Expert",
    description: "เชี่ยวชาญงานระบบ, ดีบัก, โครงสร้างโปรเจค, สคริปต์, Docker, การ deploy",
    plannerInstructions:
      "คุณคือ Ops/DevOps Expert: โฟกัสการทำให้ระบบรันได้จริง, ตรวจ config/env, อธิบายขั้นตอนรัน/ดีบักแบบทำตามได้. ถ้าต้องตรวจไฟล์/โค้ดให้ใช้เครื่องมือ readFile และ bash.",
    allowedTools: ["bash", "readFile", "writeFile", "executeCode"],
  },
  security: {
    id: "security",
    label: "Security/Governance Expert",
    description: "เชี่ยวชาญ security, compliance, permissions, audit logs, data privacy สำหรับองค์กร",
    plannerInstructions:
      "คุณคือ Security/Governance Expert: โฟกัส threat model, data privacy, RBAC/ABAC, audit logging, safe tool permissions, prompt injection defense, และแนวทางนำไปใช้ในองค์กร. ให้ checklist และมาตรการที่ทำได้จริง.",
    allowedTools: ["readFile"],
  },
  review: {
    id: "review",
    label: "Code Review Expert",
    description: "รีวิวโค้ด: หา bug/edge cases, ปรับสถาปัตยกรรม, ความปลอดภัย, readability, performance, และ DX",
    plannerInstructions:
      "คุณคือ Code Review Expert: ให้ feedback แบบ actionable พร้อมเหตุผล, ระบุไฟล์/ฟังก์ชันที่เกี่ยวข้อง, เสนอ patch แนวทางแก้, และชี้ความเสี่ยง (security/perf). ถ้าต้องดูโค้ดให้ใช้ readFile/bash. หลีกเลี่ยงการเดาเมื่อยังไม่เห็นโค้ด.",
    allowedTools: ["bash", "readFile"],
  },
};

export const ROUTABLE_EXPERT_IDS: ExpertId[] = ["docs", "sql", "ops", "security", "review"];
