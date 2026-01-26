interface RerankItem<T = unknown> {
    id: number;
    text: string;
    meta?: T;
}

interface RerankedItem<T = unknown> extends RerankItem<T> {
    rerankScore: number;
}

export async function rerankZeroRank2<T = unknown>(
    query: string,
    items: RerankItem<T>[]
): Promise<RerankedItem<T>[]> {
    const resp = await fetch("https://api.zerank.ai/v2/rerank", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZERANK_API_KEY}`,
        },
        body: JSON.stringify({
            model: "zerank-2",
            query,
            documents: items.map((x) => ({ id: x.id, text: x.text })),
            top_n: 8,
        }),
    }).catch(() => null);

    if (!resp || !resp.ok) {
        return items.map((x) => ({ ...x, rerankScore: 0 }));
    }

    const data = await resp.json();
    const scoreMap = new Map<number, number>();
    for (const r of data.results || []) {
        scoreMap.set(Number(r.id), Number(r.score));
    }

    return items
        .map((x) => ({ ...x, rerankScore: scoreMap.get(x.id) ?? 0 }))
        .sort((a, b) => b.rerankScore - a.rerankScore);
}
