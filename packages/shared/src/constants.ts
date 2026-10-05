// Verified constants: see hq CLAUDE.md "Verified constants". Re-verify before changing.
export const PROGRAM_ID = "BAj8sscSBTkfmcBUySDWBUbiYRcFkP7vH1DQ5HETNpm8"; // set by T6 devnet deploy

export const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const SGT_GROUP_MAINNET = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
export const SGT_EXAMPLE_MINT = "5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj";

export const X402_NETWORK_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const X402_NETWORK_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const X402_FACILITATOR = "https://x402.org/facilitator";

export const SEEDS = {
  config: "config",
  identity: "identity",
  campaign: "campaign",
  impression: "impression",
} as const;

// Payout split, basis points. SPEC §2.
export const SPLIT_BPS = { viewer: 7000, host: 2000, protocol: 1000 } as const;
