# What is Adrop

Adrop is the plug-in ad network for Web3 apps. A host app drops in the SDK; an agency funds one
campaign and it reaches every app on the network. Users opt in with a wallet signature and a proof of
personhood; every *qualified view* pays the person and the host app in USDC straight from the campaign's
escrow (devnet split 70% viewer, 20% host app, 10% protocol). Agencies, human or AI agent, fund
campaigns with one HTTP request over [x402](https://x402.org).

- **No token.** Payouts are USDC, on-chain, one transaction per view.
- **No wallet lists.** Agencies buy verified reach by on-chain behaviour; they never receive addresses.
- **One human, one identity.** A proof of personhood (today the Seeker Genesis Token) gates every earner.
  See [Identity](IDENTITY.md).
- **Chain-agnostic by design.** Solana first; the proof, the chain and the platform are pluggable.

| I am a... | I integrate | Start here |
|---|---|---|
| App or game developer (host) | the SDK: users opt in, ads render in your slot, you earn 20% | [Integrate the SDK](integrate.md) |
| Advertiser or agency | nothing: the self-serve page, or the SDK if your app sells its own inventory | [Run a campaign](advertise.md) |
| Agent builder | HTTP + x402: two requests, no account | [Run a campaign](advertise.md) |
| Auditor or protocol developer | the program and the server API | [Protocol](protocol.md), [Server API](api.md) |

The ad never passes through the host app's hands: advertisers put campaigns on the server, the server picks one per
viewer, the SDK renders it.

Status: devnet, built for the Colosseum Crypto World's Fair (October 2026). Code:
[github.com/adrop-org/adrop](https://github.com/adrop-org/adrop), Apache-2.0.
