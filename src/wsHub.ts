import { WebSocketServer, WebSocket } from 'ws';
import type { ServerEnvelope } from './types';
import { short } from './utils';
import { getRecentTrades } from './store';

export class WsHub {
    private wss: WebSocketServer;
    private clients = new Set<WebSocket>();

    constructor(port: number) {
        this.wss = new WebSocketServer({ port });
        console.log(`🌐 WS listening on port ${port}`);
        this.wss.on('connection', (ws) => this.onConnection(ws));

        setInterval(() => this.pingSweep(), 30_000);
    }

    private onConnection(ws: WebSocket) {
        (ws as any).isAlive = true;
        ws.on('pong', function heartbeat(this: WebSocket) { (this as any).isAlive = true; });
        this.clients.add(ws);
        console.log('✅ [CLIENT] connected');

        const trades = getRecentTrades();
        this.sendTo(ws, { type: 'init_live_trades', trades });

        ws.on('close', () => {
            this.clients.delete(ws);
            console.log('❌ [CLIENT] disconnected');
        });
        ws.on('error', (err) => {
            console.error('❌ [CLIENT] error:', (err as Error)?.message || err);
        });
    }

    private pingSweep() {
        for (const ws of this.clients) {
            if (!(ws as any).isAlive) {
                console.warn('⚠️  [CLIENT] terminating stale client');
                try { ws.terminate(); } catch {}
                this.clients.delete(ws);
                continue;
            }
            (ws as any).isAlive = false;
            try { ws.ping(); } catch (e) { console.error('❌ [CLIENT] ping:', (e as Error)?.message || e); }
        }
    }

    // Send to a single client
    sendTo(ws: WebSocket, env: ServerEnvelope) {
        try {
            ws.send(JSON.stringify(env));
            if (env.type === 'init_live_trades') {
                console.log(`📦 [INIT] sent ${env.trades.length} trade(s)`);
            }
        } catch (e) {
            console.error('❌ [SEND one] error:', (e as Error)?.message || e);
        }
    }

    // Broadcast to all clients
    broadcast(env: ServerEnvelope) {
        const msg = JSON.stringify(env);
        let delivered = 0;
        for (const ws of this.clients) {
            if (ws.readyState === ws.OPEN) {
                try { ws.send(msg); delivered++; } catch (e) {
                    console.error('❌ [BROADCAST] client error:', (e as Error)?.message || e);
                }
            }
        }
        if (env.type === 'new_trade') {
            console.log('📡 [BROADCAST new_trade]', {
                delivered: `${delivered}/${this.clients.size}`,
                side: env.trade.side,
                usdc: env.trade.usdc,
                exchange: env.trade.exchange,
                trader: short(env.trade.trader),
                outcomes: env.trade.outcomeCount,
                tx: short(env.trade.txHash),
            });
        } else {
            console.log('📡 [BROADCAST]', env.type, `to ${delivered}/${this.clients.size}`);
        }
    }

    notifyAll(topic: string, payload: unknown) {
        this.broadcast({ type: 'notify', topic, payload });
    }
}
