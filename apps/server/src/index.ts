import { Connection } from "@solana/web3.js";
import { createApp } from "./app.js";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { Helius } from "./helius.js";

const cfg = loadConfig();
const chain = new Chain(new Connection(cfg.rpcUrl, "confirmed"), cfg.feePayer);
const onChain = await chain.getConfig();
openDb(cfg.DATABASE_URL);
const app = createApp({ helius: new Helius(cfg.rpcUrl), chain, sgtGroup: onChain.sgtGroup.toBase58() });
app.listen(cfg.PORT, () => console.log(`adrop server :${cfg.PORT} program ${chain.programId.toBase58()} sgt_group ${onChain.sgtGroup.toBase58()}`));
