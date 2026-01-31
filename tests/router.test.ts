import { describe, expect, it } from "vitest";
import { routeExpert } from "../lib/agent/router";

// NOTE: This is a light smoke test. It requires OpenAI creds in env when run.
// In CI, you can skip by setting SKIP_LLM_TESTS=1.

describe("routeExpert", () => {
  it.skipIf(process.env.SKIP_LLM_TESTS === "1" || !process.env.OPENAI_API_KEY)("returns a routable expert", async () => {
    const r = await routeExpert({ query: "Please review this PR for security issues" });
    expect(["docs", "sql", "ops", "security", "review"]).toContain(r.expertId);
  });
});
