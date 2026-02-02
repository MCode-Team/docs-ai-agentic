import { openai, createOpenAI } from "@ai-sdk/openai";

/**
 * Chat model selection.
 *
 * - Default: OpenAI via OPENAI_API_KEY
 * - Ollama (OpenAI-compatible): set CHAT_PROVIDER=ollama and OLLAMA_BASE_URL
 *
 * Note: embeddings for retrieval still use OpenAI embeddings (see retrieval-*).
 */
export function getChatModel(modelId?: string) {
  const provider = (process.env.CHAT_PROVIDER || "openai").toLowerCase();
  const resolvedModel = modelId || process.env.CHAT_MODEL || "gpt-5-mini";

  if (provider === "ollama") {
    const baseURL = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434/v1";
    // Ollama's OpenAI-compatible endpoint ignores the key, but the SDK requires one.
    const apiKey = process.env.OLLAMA_API_KEY || "ollama";

    const ollama = createOpenAI({
      name: "ollama",
      apiKey,
      baseURL,
    });

    return ollama(resolvedModel as any);
  }

  return openai(resolvedModel as any);
}
