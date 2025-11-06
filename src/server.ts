import 'dotenv/config';
import { WsHub } from './wsHub';
import { startWatcher } from './watcher';

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || process.env.POLYGON_WSS_URL;

const WS_PORT = Number(process.env.PORT || process.env.WS_PORT || 8080);
const MIN_USDC = String(process.env.MIN_USDC || '500');

if (!POLYGON_RPC_URL) {
  console.error('❌ RPC URL missing: set POLYGON_RPC_URL (or POLYGON_WSS_URL).');
}

const hub = new WsHub(WS_PORT);

if (POLYGON_RPC_URL) {
  startWatcher({ rpcUrl: POLYGON_RPC_URL, minUsdc: MIN_USDC, hub })
      .catch((e) => console.error('❌ [BOOT watcher]', (e as Error)?.message || e));
}

process.on('uncaughtException', (err) => console.error('🔥 uncaughtException', err));
process.on('unhandledRejection', (r) => console.error('🔥 unhandledRejection', r));
