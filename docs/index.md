# What is Adrop

Adrop is a rewarded-ads SDK that pays the viewer. An app drops it in; users opt in with a wallet
signature and a proof of personhood; every *qualified view* of an ad pays the viewer in USDC straight
from the campaign's escrow, split 70% viewer, 20% host app, 10% protocol. Advertisers, human or AI
agent, fund campaigns with one HTTP request over [x402](https://x402.org).

- **No token.** Payouts are USDC, on-chain, one transaction per view.
- **No wallet lists.** Advertisers buy verified reach by on-chain behaviour; they never receive addresses.
- **One human, one identity.** A proof of personhood (today the Seeker Genesis Token) gates every earner.
  See [Identity](IDENTITY.md).
- **Chain-agnostic by design.** Solana first; the proof, the chain and the platform are pluggable.

| I am a... | Start here |
|---|---|
| App or game developer | [Integrate the SDK](integrate.md) |
| Advertiser or agent builder | [Run a campaign](advertise.md) |
| Auditor or protocol developer | [Protocol](protocol.md), [Server API](api.md) |

Status: devnet, built for the Colosseum Crypto World's Fair (October 2026). Code:
[github.com/adrop-org/adrop](https://github.com/adrop-org/adrop), Apache-2.0.
