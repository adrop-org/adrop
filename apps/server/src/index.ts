import { Connection, PublicKey } from "@solana/web3.js";
import { createApp } from "./app.js";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { Helius } from "./helius.js";
import { mintMockSgt } from "./sgt-mock.js";
import { X402, httpFacilitator } from "./x402.js";

const cfg = loadConfig();
const conn = new Connection(cfg.rpcUrl, "confirmed");
const chain = new Chain(conn, cfg.feePayer, cfg.attester);
const onChain = await chain.getConfig();
const db = openDb(cfg.DATABASE_URL);
const x402 = new X402({ facilitator: httpFacilitator(cfg.FACILITATOR_URL), network: cfg.X402_NETWORK, usdcMint: cfg.USDC_MINT, payTo: cfg.feePayer.publicKey.toBase58(), rpcUrl: cfg.rpcUrl });
const baseUrl = process.env.BASE_URL ?? `http://localhost:${cfg.PORT}`;
const app = createApp({ helius: new Helius(cfg.rpcUrl), chain, sgtGroup: onChain.sgtGroup.toBase58(), db, x402, usdcMint: cfg.USDC_MINT, baseUrl, rpcUrl: cfg.rpcUrl, mintSgt: async (w) => (await mintMockSgt(conn, cfg.feePayer, onChain.sgtGroup, new PublicKey(w))).toBase58(), treasuryAta: onChain.protocolTreasuryAta.toBase58(), globalDailyCap: onChain.globalDailyCap, hostAtas: cfg.HOST_ATAS });
app.listen(cfg.PORT, () => console.log(`adrop server :${cfg.PORT} program ${chain.programId.toBase58()} sgt_group ${onChain.sgtGroup.toBase58()}`));
