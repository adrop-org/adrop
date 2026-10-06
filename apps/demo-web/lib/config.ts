export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const HOST_ATA = process.env.NEXT_PUBLIC_HOST_ATA ?? "";
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const explorer = (sig: string, kind: "tx" | "address" = "tx") => `https://explorer.solana.com/${kind}/${sig}?cluster=devnet`;
