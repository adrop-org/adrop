# Integrate the SDK

`adrop-sdk` is a framework-free web SDK: an ES module and an IIFE bundle (`window.Adrop`). It is built
from this repository (`packages/sdk`, `pnpm build`); npm publication follows the hackathon.

## What you need
- A **host USDC account** (`hostAta`): the associated token account of your app's wallet for the USDC mint.
  20% of every view served in your app lands there. The server pays only host accounts it knows
  (`400 unknown_host` otherwise); during the hackathon, ask us to add yours or use the demo host's
  `GYs2Ucn7MDE27VBiN4PU2MHZfVmM24ivD2FaJVX7RoyE` to try the flow.
- A **wallet** that can `signMessage` and `signTransaction` (any Solana wallet adapter works).
- The Adrop server base URL (`apiBase`). Devnet: `https://api.adrop.sh`.

## Minimal integration
```ts
import { Adrop } from "adrop-sdk";

const adrop = Adrop.init({ apiBase: "https://api.adrop.sh", hostAta: HOST_USDC_ATA, wallet })
  .onReward(({ amount, tx, campaign_id }) => console.log(`paid ${amount} USDC`, tx))
  .onError((e) => console.warn(e.code, e.message));

await adrop.optIn();                 // registers the identity once; returns { registered, has_sgt, views_today }
const ad = await adrop.loadAd();     // null when no campaign is available for this identity right now
if (ad) await adrop.show(document.getElementById("ad-slot")!);   // resolves with the Reward once paid
```

Script tag instead of a bundler:
```html
<script src="/adrop.iife.global.js"></script>
<script>const adrop = Adrop.Adrop.init({ apiBase, hostAta, wallet });</script>
```

## API
| Call | Does |
|---|---|
| `Adrop.init({ apiBase, hostAta, wallet, fetch? })` | creates a client; `fetch` is injectable for tests |
| `optIn()` | `GET /identity/:wallet`; if unregistered, gets a `register_identity` transaction, has the wallet sign it, submits it |
| `loadAd(campaignId?)` | `POST /impressions`; returns the `Ad` (creative, `min_dwell_ms`, `price_per_view` in USDC micro-units) or `null` |
| `show(container)` | renders the creative, tracks attention, enables Claim, runs the claim and returns the `Reward` |
| `onReward(handler)`, `onError(handler)` | chainable listeners |

Errors arrive as `AdropError { code, message, status }`. Codes you will handle:
`no_sgt` (the wallet holds no proof of personhood), `no_campaign` (nothing to show now), `no_ad`
(`show()` before `loadAd()`), `attention_failed` (the view did not qualify), plus any server error.

## Rules
- The creative is always labelled **Sponsored**. Do not hide or restyle the label.
- The Claim button is disabled until the dwell and pointer checks pass. Never trigger it programmatically.
- Surface errors to the user; a failed claim is not retried silently.
- Mobile stores: Android and the Solana dApp Store allow USDC rewards (with Google Play's financial-features
  declaration); iOS native apps may not pay users in crypto. On iOS, host Adrop in a web page or a wallet's in-app browser.
