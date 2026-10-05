import { Connection } from "@solana/web3.js";
import { createApp } from "./app.js";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { Helius } from "./helius.js";
import { X402, httpFacilitator } from "./x402.js";

const cfg = loadConfig();
const chain = new Chain(new Connection(cfg.rpcUrl, "confirmed"), cfg.feePayer);
const onChain = await chain.getConfig();
const db = openDb(cfg.DATABASE_URL);
const x402 = new X402({ facilitator: httpFacilitator(cfg.FACILITATOR_URL), network: cfg.X402_NETWORK, usdcMint: cfg.USDC_MINT, payTo: cfg.feePayer.publicKey.toBase58(), rpcUrl: cfg.rpcUrl });
const baseUrl = process.env.BASE_URL ?? `http://localhost:${cfg.PORT}`;
const app = createApp({ helius: new Helius(cfg.rpcUrl), chain, sgtGroup: onChain.sgtGroup.toBase58(), db, x402, usdcMint: cfg.USDC_MINT, baseUrl });
app.listen(cfg.PORT, () => console.log(`adrop server :${cfg.PORT} program ${chain.programId.toBase58()} sgt_group ${onChain.sgtGroup.toBase58()}`));
