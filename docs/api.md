# Server API

Base URL on devnet: `https://api.adrop.sh`. JSON in and out. The SDK wraps the viewer-side calls; advertisers
and agents use the campaign calls directly. x402 V2 headers: `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`.

| Method and path | Body | Returns | Notes |
|---|---|---|---|
| `GET /health` | | `{ ok, treasury_ata, usdc_mint }` | |
| `GET /identity/:wallet` | | `{ registered, has_sgt, sgt_mint?, views_today? }` | looks up the proof of personhood, then the on-chain identity |
| `POST /identity/register-tx` | `{ wallet }` | `{ tx_base64 }` | unsigned `register_identity` transaction |
| `POST /identity/submit` | `{ signed_tx_base64 }` | `{ tx }` | server sends and confirms |
| `POST /campaigns` | `{ advertiser, tags[], price_per_view, budget, freq_cap?, min_dwell_ms?, creative{image_url,title,cta_url}, test_wallets?[] }` | `{ campaign_id, escrow_ata, fund_url }` | snapshots the audience into a Merkle root, creates the campaign on-chain, status `Draft`. `test_wallets` (max 5) is a devnet demo aid: the snapshot keeps only those registered wallets, so a tester can see the reward; advertisers never target wallet lists in the product |
| `GET /campaigns/:id` | | campaign status, budget, spent, audience size | |
| `POST /campaigns/:id/fund` | x402 payment of `budget` | `{ status: "active", settle_tx, activate_tx }` | `402` until paid; settles, forwards to escrow, activates |
| `POST /impressions` | `{ identity_wallet, host_ata, campaign_id? }` | `{ impression_id, nonce, campaign{id, creative, min_dwell_ms, price_per_view}, expires_at }` | checks identity, audience, frequency cap, daily cap; `404 no_campaign` when nothing fits |
| `POST /claims` | `{ impression_id, nonce, attention{...}, wallet_signature_of_nonce }` | `{ claim_id, tx_base64 }` | verifies nonce, attention thresholds and signature; returns the attester- and fee-payer-signed `pay_view` transaction |
| `POST /claims/:id/submit` | `{ signed_tx_base64 }` | `{ tx }` | the viewer signed; the server sends, confirms, marks the nonce used |

Attention report fields: `visible_ms`, `max_visibility`, `focused`, `pointer_event_ts`, `scroll_before_click`.
Thresholds: at least 50% visible for `min_dwell_ms`, document focused, a pointer event on the creative.
A failed check returns `422 attention_failed` with the failed checks listed.

Errors are `{ error: <code> }` with a matching HTTP status. The nonce expires 10 minutes after issue; a
`pay_view` transaction expires with its blockhash (about a minute), after which `POST /claims` can be repeated
with the same nonce.
