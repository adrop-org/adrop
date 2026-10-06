# Run a campaign

An advertiser, or an agent acting for one, needs a wallet with devnet USDC and an x402 client. No account, no login.

## 1. Create
```sh
curl -s https://api.adrop.sh/campaigns -H 'content-type: application/json' -d '{
  "advertiser": "<your wallet>",
  "tags": ["dex_swap_30d"],
  "price_per_view": 500000,
  "budget": 50000000,
  "freq_cap": 1,
  "min_dwell_ms": 3000,
  "creative": { "image_url": "https://.../banner.png", "title": "Try our DEX", "cta_url": "https://..." }
}'
```
Amounts are USDC micro-units: `500000` = $0.50 per view, `50000000` = $50 budget. `tags: []` makes an
untargeted campaign that reaches every registered identity; a tag such as `dex_swap_30d` targets a behaviour
segment. The response carries `campaign_id`, `escrow_ata` and `fund_url`. The campaign is `Draft` until funded.

## 2. Fund over x402
`POST /campaigns/:id/fund` answers `402 Payment Required` with a `PAYMENT-REQUIRED` header: scheme `exact`,
network `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` (devnet), the USDC mint, the amount (your budget) and `payTo`.
Any x402 V2 client pays it; the repository ships one:
```sh
X402_DEMO_SECRET='[...keypair bytes...]' pnpm fund:demo https://api.adrop.sh <advertiser wallet>
```
On settlement the server forwards the USDC into the campaign escrow, activates the campaign and returns
`{ status: "active", settle_tx, activate_tx }` with a `PAYMENT-RESPONSE` header.

![agent funds a campaign over x402](agent-funding.gif)

## 3. Watch it run
`GET /campaigns/:id` returns status, budget, spent and the audience size. Each paid view is one on-chain
transaction from the escrow, visible on any explorer. Unspent budget is withdrawable by the advertiser wallet
once the campaign is ended.

## What you buy
Qualified views by verified humans, at the price you set. You get counts and delivery, never wallet addresses.
See [How it works](how-it-works.md) for the definition of a qualified view.
