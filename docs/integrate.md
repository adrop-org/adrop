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

## Quickstart from zero

Tested 2026-10-07 from a fresh clone, no monorepo:

```sh
git clone https://github.com/adrop-org/adrop-sdk && cd adrop-sdk
pnpm install && pnpm build          # dist/adrop.iife.global.js (web3.js bundled) and dist/index.js (ESM)
```

Copy `dist/adrop.iife.global.js` next to an `index.html` and wire the three buttons: connect, opt in, load ad.

```html
<script src="adrop.iife.global.js"></script>
<script>
  const phantom = window.solana;                       // or any wallet adapter
  const { publicKey } = await phantom.connect();
  const wallet = {
    publicKey,
    signMessage: async (m) => (await phantom.signMessage(m, "utf8")).signature,   // Phantom's provider returns { signature }
    signTransaction: (tx) => phantom.signTransaction(tx),
  };
  const adrop = Adrop.Adrop.init({ apiBase: "https://api.adrop.sh", hostAta: "GYs2Ucn7MDE27VBiN4PU2MHZfVmM24ivD2FaJVX7RoyE", wallet })
    .onReward((r) => console.log("paid", r.amount / 1e6, "USDC", r.tx));
  await adrop.optIn();
  if (await adrop.loadAd()) adrop.show(document.getElementById("slot"));
</script>
```

Wallet shapes: a `@solana/wallet-adapter-*` adapter already has `publicKey`, `signMessage(Uint8Array) → Uint8Array`
and `signTransaction`, so pass it as is. A raw browser provider (Phantom's `window.solana`) returns
`{ signature }` from `signMessage`; unwrap it as above.

Devnet identity: `optIn()` needs a Genesis Token in the wallet. On devnet, mint the mock one with the
"Mint a devnet Genesis Token" button on https://demo.adrop.sh, then come back; the identity is bound to the token,
not to the page that minted it. Get an ad: the demo campaigns target the `dex_swap_30d` audience (wallets that hold a
devnet USDC account) or nobody in particular; `loadAd()` returns `null` when no campaign includes your identity.

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
