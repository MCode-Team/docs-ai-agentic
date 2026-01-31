import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { EXPERTS, ROUTABLE_EXPERT_IDS, type ExpertId } from "./experts";

export interface RouteResult {
  expertId: ExpertId;
  rationale: string;
}

const ROUTER_SYSTEM_PROMPT = `You are an LLM router for an agentic AI web chat.
Choose the single best expert for the user's query.

Experts:
- docs: questions about product docs, architecture, how-to, explanations grounded in documentation.
- sql: questions about databases, schemas, analytics, data dictionary, queries, KPIs.
- ops: questions about running/debugging/building/deploying the system, Docker, environment variables, file/code operations.
- security: questions about governance, RBAC, permissions, audit logs, privacy, threat modeling, safe tool use.
- review: code review requests, PR review, architecture review, bug-finding, refactor suggestions.

Rules:
- Return STRICT JSON only.
- Output shape: {"expertId": "docs|sql|ops|security|review", "rationale": "..."}
- Keep rationale under 2 sentences.
`;

export async function routeExpert(input: {
  query: string;
  docsContext?: string;
  dictContext?: string;
}): Promise<RouteResult> {
  const user = {
    query: input.query,
    hints: {
      hasDocsContext: Boolean(input.docsContext && input.docsContext.trim() && input.docsContext !== "(ไม่มี)"),
      hasDictContext: Boolean(input.dictContext && input.dictContext.trim() && input.dictContext !== "(ไม่มี)"),
    },
  };

  const result = await generateText({
    model: openai("gpt-5-mini"),
    system: ROUTER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(user) }],
  });

  try {
    const parsed = JSON.parse(result.text) as RouteResult;
    if (!ROUTABLE_EXPERT_IDS.includes(parsed.expertId)) {
      return { expertId: "docs", rationale: "Fallback to docs expert." };
    }
    return parsed;
  } catch {
    return { expertId: "docs", rationale: "Fallback to docs expert." };
  }
}

export function getExpertProfile(expertId: ExpertId) {
  return EXPERTS[expertId];
}
