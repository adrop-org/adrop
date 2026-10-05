# Reused and adapted code

| Where | Source | What |
|---|---|---|
| `scripts/sgt-mock.ts` | Solana docs, Token-2022 "Group Pointer" / "Group Member Pointer" / "Metadata Pointer" extension guides (solana.com/developers/guides/token-extensions) | Mint creation sequence with `@solana/spl-token` group and pointer instructions |
| `tests/fixtures/sgt-mint.json` | Mainnet account `5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj`, cloned with `solana account --output json` | Real Seeker Genesis Token mint, used read-only in tests |

Everything else is written for this project.
