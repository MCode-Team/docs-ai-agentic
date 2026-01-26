interface RerankItem<T = unknown> {
    id: number;
    text: string;
    meta?: T;
}

interface RerankedItem<T = unknown> extends RerankItem<T> {
    rerankScore: number;
}

// Local zerank-2 service URL (Docker container)
const ZERANK_URL = process.env.ZERANK_URL || "http://localhost:8787";

export async function rerankZeroRank2<T = unknown>(
    query: string,
    items: RerankItem<T>[]
): Promise<RerankedItem<T>[]> {
    const resp = await fetch(`${ZERANK_URL}/rerank`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query,
            texts: items.map((x) => x.text),
        }),
    }).catch(() => null);

    if (!resp || !resp.ok) {
        return items.map((x) => ({ ...x, rerankScore: 0 }));
    }

    const data = await resp.json();

    // TEI format returns results with index and score
    const scoreMap = new Map<number, number>();
    for (const r of data.results || []) {
        scoreMap.set(Number(r.index), Number(r.score));
    }

    return items
        .map((x, idx) => ({ ...x, rerankScore: scoreMap.get(idx) ?? 0 }))
        .sort((a, b) => b.rerankScore - a.rerankScore);
}

