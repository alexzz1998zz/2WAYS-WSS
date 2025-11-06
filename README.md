# Polymarket Trade Monitor Service

WebSocket server that monitors Polymarket trades >= $500 USDC on Polygon blockchain and broadcasts them in real-time.

## 🚀 Quick Deploy

### Railway (Recommended - Free Tier Available)

1. **Create a new project on [Railway](https://railway.app/)**
2. **Connect your GitHub repo** or upload these files
3. **Add environment variables** in Railway dashboard:
   - `POLYGON_WSS_URL` - Your Alchemy WebSocket URL
   - `WS_PORT` - Port number (Railway will auto-assign if not set)
   - `MIN_USDC` - Minimum trade size (default: 500)
4. **Set start command**: `npm start`
5. **Deploy!** Railway will automatically install dependencies and start the service

### Render (Free Tier Available)

1. **Create a new Web Service on [Render](https://render.com/)**
2. **Connect your GitHub repo**
3. **Configure:**
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Add environment variables** in Render dashboard
5. **Deploy!**

### DigitalOcean App Platform

1. **Create a new App on [DigitalOcean](https://cloud.digitalocean.com/apps)**
2. **Connect your GitHub repo**
3. **Configure:**
   - Run Command: `npm start`
4. **Add environment variables**
5. **Deploy!**

## 📋 Required Environment Variables

\`\`\`env
# Required: Alchemy Polygon WebSocket URL
POLYGON_WSS_URL=wss://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Optional: WebSocket server port (default: 8080)
WS_PORT=8080

# Optional: Minimum USDC trade size (default: 500)
MIN_USDC=500
\`\`\`

## 🔑 Getting an Alchemy API Key

1. Go to [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Create a free account
3. Create a new app with **Polygon Mainnet**
4. Copy the WebSocket URL (starts with `wss://`)

## 🔗 Connecting Your Frontend

After deploying, you'll get a WebSocket URL like:
- Railway: `wss://your-app.railway.app`
- Render: `wss://your-app.onrender.com`
- DigitalOcean: `wss://your-app.ondigitalocean.app`

Add this to your Vercel project's environment variables:
\`\`\`env
NEXT_PUBLIC_TRADES_WS=wss://your-deployed-service-url
\`\`\`

## 🧪 Local Development

\`\`\`bash
# Install dependencies
npm install

# Copy .env.example to .env and add your Alchemy API key
cp .env.example .env

# Start the service
npm run dev
\`\`\`

## 📊 What It Does

1. **Monitors** Polygon blockchain for USDC transfers to/from Polymarket exchanges (CTF & NegRisk)
2. **Filters** trades >= $500 USDC (configurable)
3. **Decodes** ERC-1155 token transfers to get outcome tokens
4. **Broadcasts** formatted trade data to all connected WebSocket clients

## 🔍 Trade Data Format

\`\`\`json
{
  "txHash": "0x...",
  "side": "BUY" | "SELL",
  "trader": "0x...",
  "exchange": "CTF" | "NegRisk",
  "usdc": "1234.56",
  "outcomes": [
    { "id": "123", "shares": "1000000000000000000" }
  ],
  "outcomeCount": 1,
  "blockTimestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`

## 🐛 Troubleshooting

**Service won't start:**
- Check that `POLYGON_WSS_URL` is set correctly
- Verify your Alchemy API key is valid
- Check logs for specific error messages

**No trades appearing:**
- Verify the service is running (check logs)
- Ensure `MIN_USDC` threshold isn't too high
- Check that your frontend is connecting to the correct WebSocket URL

**Connection issues:**
- Make sure your deployment platform allows WebSocket connections
- Check firewall/security group settings
- Verify the WebSocket port is exposed (Railway/Render handle this automatically)

## 📝 Notes

- The service automatically reconnects if the Alchemy connection drops
- Trades are only broadcast to currently connected clients (not stored)
- The service uses minimal resources and should run on free tiers
