export type TradeOutcome = { id: string; shares: string };

export type MarketInfo = {
    marketId: string;
    title: string;
    image?: string | undefined;
    slug?: string | undefined;
    outcomeLabel: string;
};

export type TradePayload = {
    txHash: `0x${string}`;
    side: 'BUY' | 'SELL';
    trader: `0x${string}`;
    exchange: 'CTF' | 'NegRisk';
    usdc: string;
    outcomes: TradeOutcome[];
    outcomeCount: number;
    markets: (MarketInfo & { tokenId: string })[];
    blockTimestamp: string;
};

export type ServerEnvelope =
    | { type: 'init_live_trades'; trades: TradePayload[] }
    | { type: 'new_trade'; trade: TradePayload }
    | { type: 'heartbeat'; ts: number }
    | { type: 'error'; code: string; message: string }
    | { type: 'notify'; topic: string; payload: unknown };
