# Adrop

Rewarded ads that pay the viewer. An app drops in the Adrop SDK; users opt in with a wallet
signature and a proof of personhood (on Solana, the Seeker Genesis Token); every qualified ad
view pays the viewer in USDC straight from the campaign's escrow, split 70% viewer, 20% host
app, 10% protocol. Advertisers, human or AI agent, fund campaigns with one HTTP request over
[x402](https://x402.org). No token, no wallet lists: advertisers buy verified reach, never
addresses.

Built for the Colosseum Crypto World's Fair, October 2026. Solana devnet.

## Layout
```
programs/adrop/    Anchor program: identities, campaigns, escrow, pay_view
packages/shared/   constants, Merkle helpers shared by server and SDK
packages/sdk/      adrop-sdk, framework-free web build (ESM + IIFE)
apps/server/       Express: x402 funding, impressions, claims, attester
apps/demo-web/     Next.js host app that integrates the SDK like a third party would
infra/             docker-compose, Caddy, .env.example
docs/              DISCLOSURE.md (reused code), VALIDATION.md
```

## Run
Filled in as each part lands. Requirements: Node 20, pnpm, Rust, Solana CLI, Anchor.

```sh
pnpm install
pnpm test            # Anchor tests
```

## Licence
Apache-2.0, see `LICENSE`.
