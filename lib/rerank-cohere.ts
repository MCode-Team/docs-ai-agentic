interface RerankItem<T = unknown> {
    id: number;
    text: string;
    meta?: T;
}

interface RerankedItem<T = unknown> extends RerankItem<T> {
    rerankScore: number;
}

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_RERANK_MODEL = process.env.COHERE_RERANK_MODEL || "rerank-v4.0-fast";

/**
 * Rerank items using Cohere Reranking API
 * https://docs.cohere.com/reference/rerank
 */
export async function rerankCohere<T = unknown>(
    query: string,
    items: RerankItem<T>[]
): Promise<RerankedItem<T>[]> {
    // If no API key or no items, return items with score 0
    if (!COHERE_API_KEY || items.length === 0) {
        console.warn("[Cohere Rerank] No API key or empty items, skipping rerank");
        return items.map((x) => ({ ...x, rerankScore: 0 }));
    }

    try {
        const resp = await fetch("https://api.cohere.com/v2/rerank", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${COHERE_API_KEY}`,
            },
            body: JSON.stringify({
                model: COHERE_RERANK_MODEL,
                query,
                documents: items.map((x) => x.text),
                top_n: items.length, // Return all items ranked
            }),
        });

        if (!resp.ok) {
            const errorText = await resp.text();
            console.error("[Cohere Rerank] API Error:", resp.status, errorText);
            return items.map((x) => ({ ...x, rerankScore: 0 }));
        }

        const data = await resp.json();

        // Cohere returns results with index and relevance_score
        // { results: [{ index: 0, relevance_score: 0.99 }, ...] }
        const scoreMap = new Map<number, number>();
        for (const r of data.results || []) {
            scoreMap.set(Number(r.index), Number(r.relevance_score));
        }

        return items
            .map((x, idx) => ({ ...x, rerankScore: scoreMap.get(idx) ?? 0 }))
            .sort((a, b) => b.rerankScore - a.rerankScore);
    } catch (error) {
        console.error("[Cohere Rerank] Fetch Error:", error);
        return items.map((x) => ({ ...x, rerankScore: 0 }));
    }
}
