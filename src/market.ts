import type { MarketInfo } from './types';

type MarketApi = {
    id: string;
    question: string;
    image?: string;
    icon?: string;
    outcomes: string;
    clobTokenIds: string;
    slug?: string;
};

const marketCache = new Map<string, MarketInfo>();

export async function fetchMarket(tokenId: string): Promise<MarketInfo> {
    const hit = marketCache.get(tokenId);
    if (hit) return hit;

    const url = `https://gamma-api.polymarket.com/markets?clob_token_ids=${tokenId}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = (await res.json()) as MarketApi[];
        const m = arr[0];
        if (!m) throw new Error('no market');

        const outs = JSON.parse(m.outcomes) as string[];
        const ids = JSON.parse(m.clobTokenIds) as string[];
        const idx = ids.findIndex((x) => x === tokenId);

        const info: MarketInfo = {
            marketId: m.id,
            title: m.question,
            image: m.image ?? m.icon ?? undefined,
            slug: m.slug ?? undefined,
            outcomeLabel: outs[idx] ?? 'Outcome',
        };

        marketCache.set(tokenId, info);
        return info;
    } catch (e) {
        console.error('❌ [MARKET]', { tokenId, err: (e as Error)?.message || e });
        return { marketId: 'unknown', title: 'Polymarket trade', image: undefined, slug: undefined, outcomeLabel: 'Outcome' };
    }
}
