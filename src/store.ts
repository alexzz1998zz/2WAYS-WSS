import type { TradePayload } from './types';

const RECENT_MAX = 100;
const recentTrades: TradePayload[] = []; // newest-first

export function pushRecentTrade(trade: TradePayload) {
    recentTrades.unshift(trade);
    if (recentTrades.length > RECENT_MAX) recentTrades.length = RECENT_MAX;
}

export function getRecentTrades(): TradePayload[] {
    return recentTrades.slice(); // shallow copy
}
