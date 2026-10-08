# Identity: how Adrop knows a viewer is one human

Every qualified view pays USDC out of an advertiser's escrow. Without a one-human-once check,
one person with a script and a thousand wallets drains any campaign in minutes. Adrop therefore
binds each earning identity to exactly one **proof of personhood**.

## The proof is pluggable

On-chain, an `Identity` holds `proof_type` (one byte) and a 32-byte `proof_nullifier`. Campaigns,
impressions and payouts never look at the proof again: they only check that the identity exists,
that it is under its daily cap, and that it belongs to the campaign's audience. Adding a proof
means adding one registration path. Nothing else moves.

| proof_type | Proof | Chains / platforms | Status |
|---|---|---|---|
| 0 | Seeker Genesis Token (SGT) | Solana, Seeker phone owners | implemented |
| 1 | World ID | any chain, web and games | roadmap, next |
| 2 | Coinbase Verifications | EVM attestations | roadmap |
| 3 | Play Integrity / App Attest | mobile games, device-level, lower tier | roadmap |

A wallet with no proof can use any app that embeds the SDK; it just does not earn until it
verifies once.

## Why the Seeker Genesis Token first

- **Free and already there.** Solana Mobile mints one SGT per Seeker phone at activation. Every
  Seeker owner already holds one; opting in is a single wallet signature.
- **Hard to farm.** One token per device, bought with real money. Transferring it between the
  owner's own accounts is allowed, so the identity keys to the *mint address*, never the wallet.
- **Verifiable on-chain.** A mint is a real SGT when both its Token-2022 Metadata Pointer and
  Token Group Member extensions point at group `GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te`.
  The program checks this itself; no oracle.

Adrop never creates or issues the token. It only reads it.

## Devnet

Solana Mobile does not mint on devnet, so the test deployment uses a mock: a Token-2022 mint with
the same two extensions, pointing at a group Adrop controls. The only difference between devnet
and mainnet is that group address in the program config. For a test wallet, the project team
mints one mock token once; see the README for the command.

## Closed audiences (roadmap)

A proof of personhood is required for *open* audiences: untargeted campaigns and behaviour
segments, where anyone who can create wallets could otherwise drain the escrow. It is not
required for a *closed* list, where the advertiser brings the wallets it already holds (its own
users, or a list it bought) and bears the sybil risk itself. Adrop learns such a list only to
build the campaign's Merkle root and never hands wallets to anyone; advertisers get counts,
delivery and spend. The list-only registration path and the `proof_type` value for it are
roadmap; today every earning identity holds a proof.

## What is not a proof

Email, phone number or a social login alone. Ad-fraud operations hold those in bulk, and the
advertiser pays for every fake view. A lower-priced tier for unverified users is a pricing
decision Adrop may make later; it is not a substitute for a proof.
