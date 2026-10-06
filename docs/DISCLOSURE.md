# Reused and adapted code

| Where | Source | What |
|---|---|---|
| `scripts/sgt-mock.ts`, `apps/server/src/sgt-mock.ts` | Solana docs, Token-2022 "Group Pointer" / "Group Member Pointer" / "Metadata Pointer" extension guides (solana.com/developers/guides/token-extensions) | Mint creation sequence with `@solana/spl-token` group and pointer instructions |
| `tests/fixtures/sgt-mint.json` | Mainnet account `5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj`, cloned with `solana account --output json` | Real Seeker Genesis Token mint, used read-only in tests |
| `apps/server/scripts/x402-spike.ts`, x402 routes | `@x402/express`, `@x402/fetch`, `@x402/svm` READMEs (github.com/coinbase/x402) | Middleware wiring and paying-client setup, adapted |

Everything else is written for this project.
