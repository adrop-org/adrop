import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import { USDC_MINT_DEVNET, X402_FACILITATOR, X402_NETWORK_DEVNET } from "@adrop/shared";

const Env = z.object({
  HELIUS_API_KEY: z.string().min(1),
  RPC_URL: z.string().url().optional(),
  ATTESTER_SECRET: z.string().min(1),
  FEE_PAYER_SECRET: z.string().min(1),
  FACILITATOR_URL: z.string().url().default(X402_FACILITATOR),
  X402_NETWORK: z.string().default(X402_NETWORK_DEVNET),
  USDC_MINT: z.string().default(USDC_MINT_DEVNET),
  PROTOCOL_TREASURY: z.string().min(32),
  DATABASE_URL: z.string().default("./data/adrop.sqlite"),
  PORT: z.coerce.number().default(3000),
});

export type Config = ReturnType<typeof loadConfig>;

export const keypairFromEnv = (s: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const e = Env.parse(env);
  return {
    ...e,
    rpcUrl: e.RPC_URL ?? `https://devnet.helius-rpc.com/?api-key=${e.HELIUS_API_KEY}`,
    attester: keypairFromEnv(e.ATTESTER_SECRET),
    feePayer: keypairFromEnv(e.FEE_PAYER_SECRET),
  };
}
