import 'dotenv/config';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { startWatcher, type Broadcaster } from './watcher';
import { getRecentTrades } from './store';
import type { ServerEnvelope } from './types';
import { short } from './utils';

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || process.env.POLYGON_WSS_URL;
const PORT = Number(process.env.PORT || process.env.WS_PORT || 8080);
const MIN_USDC = String(process.env.MIN_USDC || '500');

// --- in-memory client set
const clients = new Set<WebSocket>();

// --- helpers
function sendTo(ws: WebSocket, env: ServerEnvelope) {
  try {
    ws.send(JSON.stringify(env));
    if (env.type === 'init_live_trades') {
      console.log(`📦 [INIT] sent ${env.trades.length} trade(s)`);
    }
  } catch (e) {
    console.error('❌ [SEND one] error:', (e as Error)?.message || e);
  }
}

function broadcast(env: ServerEnvelope) {
  const msg = JSON.stringify(env);
  let delivered = 0;
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      try { ws.send(msg); delivered++; } catch (e) {
        console.error('❌ [BROADCAST] client error:', (e as Error)?.message || e);
      }
    }
  }
  if (env.type === 'new_trade') {
    console.log('📡 [BROADCAST new_trade]', {
      delivered: `${delivered}/${clients.size}`,
      side: env.trade.side,
      usdc: env.trade.usdc,
      exchange: env.trade.exchange,
      trader: short(env.trade.trader),
      outcomes: env.trade.outcomeCount,
      tx: short(env.trade.txHash),
    });
  } else {
    console.log('📡 [BROADCAST]', env.type, `to ${delivered}/${clients.size}`);
  }
}

function notifyAll(topic: string, payload: unknown) {
  broadcast({ type: 'notify', topic, payload });
}

// --- tiny HTTP server (health + recent)
const httpServer = http.createServer((req, res) => {
  if (!req.url) { res.statusCode = 400; return res.end('bad request'); }
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  if (url.pathname === '/recent') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ trades: getRecentTrades() }));
  }

  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('polymarket live ws');
});

// --- attach WS to same HTTP server (plain ws; Render does TLS in front)
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  (ws as any).isAlive = true;
  ws.on('pong', function heartbeat(this: WebSocket) { (this as any).isAlive = true; });
  clients.add(ws);
  console.log('✅ [CLIENT] connected');

  // init snapshot
  sendTo(ws, { type: 'init_live_trades', trades: getRecentTrades() });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('❌ [CLIENT] disconnected');
  });
  ws.on('error', (err) => {
    console.error('❌ [CLIENT] error:', (err as Error)?.message || err);
  });
});

// keep-alive sweep
setInterval(() => {
  for (const ws of clients) {
    if (!(ws as any).isAlive) {
      console.warn('⚠️  [CLIENT] terminating stale client');
      try { ws.terminate(); } catch {}
      clients.delete(ws);
      continue;
    }
    (ws as any).isAlive = false;
    try { ws.ping(); } catch (e) { console.error('❌ [CLIENT] ping:', (e as Error)?.message || e); }
  }
}, 30_000);

httpServer.listen(PORT, () => {
  console.log(`🌐 HTTP+WS listening on :${PORT} (Render will provide WSS externally)`);
});

// --- pass a minimal broadcaster to the watcher
const broadcaster: Broadcaster = { broadcast, notifyAll };

if (!POLYGON_RPC_URL) {
  console.error('❌ RPC URL missing: set POLYGON_RPC_URL or POLYGON_WSS_URL');
} else {
  startWatcher({ rpcUrl: POLYGON_RPC_URL, minUsdc: MIN_USDC, hub: broadcaster })
      .catch((e) => console.error('❌ [BOOT watcher]', (e as Error)?.message || e));
}

process.on('uncaughtException', (err) => console.error('🔥 uncaughtException', err));
process.on('unhandledRejection', (r) => console.error('🔥 unhandledRejection', r));
