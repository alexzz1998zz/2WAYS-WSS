// src/watcher.ts
import {
    createPublicClient,
    webSocket,
    http,
    parseAbiItem,
    parseEventLogs,
    getAddress,
} from 'viem';
import { polygon } from 'viem/chains';
import type { ServerEnvelope, TradePayload } from './types';
import { fetchMarket } from './market';
import { pushRecentTrade } from './store';
import { fromUnits, toUnits, USDC_DEC, short } from './utils';

/** Minimal broadcaster the server passes in (HTTP+WS combo). */
export type Broadcaster = {
    broadcast: (env: ServerEnvelope) => void;
    notifyAll: (topic: string, payload: unknown) => void;
};

export type WatcherOpts = {
    rpcUrl: string;
    minUsdc: string; // decimal string (e.g. "500")
    hub: Broadcaster;
};

/** Addresses (checksummed) */
const ADDR = {
    USDCe: getAddress('0x2791bca1f2de4661ed88a30c99a7a9449aa84174'),
    EX_CTF: getAddress('0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e'),
    EX_NEG: getAddress('0xc5d563a36ae78145c45a50134d48a1215220f80a'),
    ERC1155: getAddress('0x4d97dcd97ec945f40cf65f87097ace5ea0476045'),
};
const EXCHANGES = new Set([ADDR.EX_CTF, ADDR.EX_NEG]);

/** ABIs (events) */
const ERC20_Transfer = parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 value)'
);
const ERC1155_Single = parseAbiItem(
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
);
const ERC1155_Batch = parseAbiItem(
    'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
);

export async function startWatcher({ rpcUrl, minUsdc, hub }: WatcherOpts) {
    const THRESHOLD = toUnits(minUsdc, USDC_DEC);

    // Viem transport: ws for wss:// or ws://; http for http(s) RPC
    const transport = rpcUrl.startsWith('ws') ? webSocket(rpcUrl) : http(rpcUrl);
    const client = createPublicClient({ chain: polygon, transport });

    console.log('🚀 [WATCH] start');
    console.log(`💰 [FILTER] >= $${minUsdc}`);
    console.log(`🔗 [RPC] ${rpcUrl}`);

    let unwatch: (() => void) | null = null;
    let backoff = 1000;

    const run = async () => {
        try {
            unwatch = client.watchEvent({
                address: ADDR.USDCe,
                event: ERC20_Transfer,
                strict: false,
                onLogs: async (logs) => {
                    for (const log of logs) {
                        try {
                            const { from, to, value } = log.args as {
                                from: `0x${string}`;
                                to: `0x${string}`;
                                value: bigint;
                            };

                            const F = getAddress(from);
                            const T = getAddress(to);

                            // touch one of the exchanges & pass threshold
                            if (!(EXCHANGES.has(F) || EXCHANGES.has(T))) continue;
                            if (value < THRESHOLD) continue;

                            const toEx = EXCHANGES.has(T);
                            const exchange = toEx
                                ? (T === ADDR.EX_CTF ? 'CTF' : 'NegRisk')
                                : (F === ADDR.EX_CTF ? 'CTF' : 'NegRisk');
                            const direction = toEx ? 'in' : 'out';
                            const trader = toEx ? F : T;

                            const usdcPretty = fromUnits(value, USDC_DEC);
                            console.log('💸 [MATCH]', {
                                notional: `$${usdcPretty}`,
                                dir: direction,
                                ex: exchange,
                                trader: short(trader),
                                tx: short(log.transactionHash!),
                            });

                            // fetch receipt → parse ERC1155 transfers
                            const receipt = await client.getTransactionReceipt({ hash: log.transactionHash! });
                            const decoded = parseEventLogs({
                                abi: [ERC1155_Single, ERC1155_Batch],
                                logs: receipt.logs,
                                strict: false,
                            });

                            // net shares to trader by tokenId
                            const net = new Map<string, bigint>();
                            for (const ev of decoded) {
                                if (!ev.address) continue;
                                const evAddr = getAddress(ev.address as `0x${string}`);
                                if (evAddr !== ADDR.ERC1155) continue;

                                if (ev.eventName === 'TransferSingle') {
                                    const { from: f, to: t, id, value: v } = ev.args as any;
                                    const F2 = getAddress(f);
                                    const T2 = getAddress(t);
                                    const tokenId = (id as bigint).toString();
                                    const amt = v as bigint;

                                    if (direction === 'in' && EXCHANGES.has(F2) && T2 === trader) {
                                        net.set(tokenId, (net.get(tokenId) ?? 0n) + amt);
                                    }
                                    if (direction === 'out' && EXCHANGES.has(T2) && F2 === trader) {
                                        net.set(tokenId, (net.get(tokenId) ?? 0n) + amt);
                                    }
                                }

                                if (ev.eventName === 'TransferBatch') {
                                    const { from: f, to: t, ids, values } = ev.args as any;
                                    const F2 = getAddress(f);
                                    const T2 = getAddress(t);
                                    const idsArr = ids as bigint[];
                                    const valsArr = values as bigint[];

                                    const condIn = direction === 'in' && EXCHANGES.has(F2) && T2 === trader;
                                    const condOut = direction === 'out' && EXCHANGES.has(T2) && F2 === trader;
                                    if (!condIn && !condOut) continue;

                                    idsArr.forEach((id: bigint, i: number) => {
                                        const tokenId = id.toString();
                                        const add = valsArr[i] as bigint;
                                        net.set(tokenId, (net.get(tokenId) ?? 0n) + add);
                                    });
                                }
                            }

                            const outcomes = [...net.entries()]
                                .filter(([, v]) => v > 0n)
                                .map(([id, v]) => ({ id, shares: fromUnits(v, 6) }));

                            const markets = await Promise.all(
                                outcomes.map(async (o) => ({ tokenId: o.id, ...(await fetchMarket(o.id)) }))
                            );

                            const trade: TradePayload = {
                                txHash: log.transactionHash!,
                                side: direction === 'in' ? 'BUY' : 'SELL',
                                trader,
                                exchange,
                                usdc: usdcPretty,
                                outcomes,
                                outcomeCount: outcomes.length,
                                markets,
                                blockTimestamp: new Date().toISOString(),
                            };

                            // memory + broadcast
                            pushRecentTrade(trade);
                            hub.broadcast({ type: 'new_trade', trade });
                        } catch (e) {
                            console.error('❌ [PROCESS]', (e as Error)?.message || e);
                        }
                    }
                },
                onError: (err) => {
                    console.error('❌ [WATCH]', (err as Error)?.message || err);
                },
            });

            console.log('✅ [WATCH] subscribed to USDC.e Transfer');
        } catch (e) {
            console.error('❌ [WATCH] setup', (e as Error)?.message || e);
            scheduleRestart();
        }
    };

    function scheduleRestart() {
        try { unwatch?.(); } catch {}
        setTimeout(() => {
            console.warn('♻️  [WATCH] restart');
            run().catch((e) => console.error('❌ [RESTART]', (e as Error)?.message || e));
        }, backoff);
        backoff = Math.min(backoff * 2, 30_000);
    }

    await run();
}
