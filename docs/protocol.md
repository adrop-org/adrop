# Protocol (on-chain)

Anchor program `BAj8sscSBTkfmcBUySDWBUbiYRcFkP7vH1DQ5HETNpm8` on Solana devnet. Source: `programs/adrop`.

## Accounts
| PDA | Seeds | Holds |
|---|---|---|
| `Config` | `["config"]` | admin, attester, protocol treasury USDC account, proof group, USDC mint, global daily cap |
| `Identity` | `["identity", proof_nullifier]` | current wallet, proof type, nullifier (sha256 of the proof's mint), views today and the day counter |
| `Campaign` | `["campaign", id]` | advertiser, audience Merkle root, price per view, minimum dwell, frequency cap, budget, spent, status |
| escrow | the campaign PDA's USDC associated token account | the budget; the campaign PDA is the only authority |
| `Impression` | `["impression", campaign, nonce_hash]` | existence means paid: the double-pay guard |

## Instructions
| Instruction | Signers | Checks |
|---|---|---|
| `initialize` | admin | once |
| `register_identity` | the wallet | the wallet holds exactly one proof token, the token is genuine (both Token-2022 extensions point to the proof group), no identity exists for this proof yet |
| `create_campaign` | any payer | price > 0; stores the advertiser; creates the escrow; status `Draft` |
| `activate_campaign` | anyone | escrow balance ≥ price per view; `Draft` → `Active` |
| `pay_view` | viewer, attester, fee payer | campaign `Active`; identity owned by the viewer; Merkle membership proof against the campaign root; global daily cap; escrow ≥ price; creates the `Impression`; transfers 70 / 20 / 10 to viewer, host and protocol USDC accounts |
| `end_campaign` | advertiser or admin | |
| `withdraw_unspent` | advertiser | status `Ended` or `Draft` |

What the program does **not** check, and who does: attention (dwell, visibility, focus, pointer) and the
per-campaign frequency cap are attested off-chain by the attester's signature on the transaction. Which host
served the view is the host USDC account in the signed transaction. The audience root is a snapshot
commitment the advertiser can audit; membership trust rests on the attester, which builds both root and proofs.

## Trust and limits, stated plainly
- One attester key. Multi-attester or a TEE is roadmap.
- The attester and the fee payer are separate keys; neither can move escrow funds without the viewer's signature.
- Payouts are public on-chain. "No lists" means advertisers never receive an audience; it does not make
  payments anonymous.
- Devnet uses a mock proof group; mainnet uses the Seeker Genesis Token group. Nothing else differs.
