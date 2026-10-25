export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const HOST_ATA = process.env.NEXT_PUBLIC_HOST_ATA ?? "";
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.adrop.sh";
// Campaigns the console shows: the curated set plus anything created after it (owner, 2026-10-25).
export const CONSOLE_CAMPAIGNS = (process.env.NEXT_PUBLIC_CONSOLE_CAMPAIGNS ?? "49,52,53").split(",").map(Number);
export const FALLBACK_VIDEO = process.env.NEXT_PUBLIC_FALLBACK_VIDEO ?? "/rome-fallback.mp4";
export const explorer = (sig: string, kind: "tx" | "address" = "tx") => `https://explorer.solana.com/${kind}/${sig}?cluster=devnet`;
export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const money = (n: number, cents = !Number.isInteger(n)) => "$" + n.toLocaleString("en-US", cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {});
export const usd = (micro: number) => money(micro / 1e6, true);
