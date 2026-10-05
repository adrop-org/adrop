// pnpm seg:build — rebuilds the demo segment from registered identities (SPEC §5).
import { Connection } from "@solana/web3.js";
import { Chain } from "../src/chain.js";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { Helius } from "../src/helius.js";
import { DEMO_TAG, buildSegment } from "../src/segments.js";

const cfg = loadConfig();
const chain = new Chain(new Connection(cfg.rpcUrl, "confirmed"), cfg.feePayer);
const db = openDb(cfg.DATABASE_URL);
const out = await buildSegment(DEMO_TAG, db, chain, new Helius(cfg.rpcUrl), cfg.USDC_MINT);
console.log(JSON.stringify({ tag: DEMO_TAG, ...out }));
