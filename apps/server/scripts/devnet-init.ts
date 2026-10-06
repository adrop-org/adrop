// One-time devnet setup: mock SGT group (authority = fee payer), protocol treasury USDC ATA,
// program `initialize`. Idempotent: skips when config exists. Run with secrets in env (SPEC §4).
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Chain } from "../src/chain.js";
import { loadConfig } from "../src/config.js";
import { createSgtGroup } from "../../../scripts/sgt-mock.js";

const cfg = loadConfig();
const conn = new Connection(cfg.rpcUrl, "confirmed");
const chain = new Chain(conn, cfg.feePayer);
const existing = await chain.program.account.config.fetchNullable(chain.configPda);
if (existing) {
  console.log(JSON.stringify({ status: "exists", sgt_group: existing.sgtGroup.toBase58(), attester: existing.attester.toBase58(), treasury_ata: existing.protocolTreasuryAta.toBase58() }));
  process.exit(0);
}
const usdc = new PublicKey(cfg.USDC_MINT);
const treasury = new PublicKey(cfg.PROTOCOL_TREASURY);
const group = process.env.SGT_GROUP ? new PublicKey(process.env.SGT_GROUP) : await createSgtGroup(conn, cfg.feePayer, cfg.feePayer);
const treasuryAta = (await getOrCreateAssociatedTokenAccount(conn, cfg.feePayer, usdc, treasury)).address;
const cap = Number(process.env.GLOBAL_DAILY_CAP ?? 10);
const sig = await chain.program.methods.initialize(cfg.attester.publicKey, group, usdc, cap)
  .accountsPartial({ admin: cfg.feePayer.publicKey, config: chain.configPda, protocolTreasuryAta: treasuryAta, systemProgram: SystemProgram.programId })
  .rpc();
console.log(JSON.stringify({ status: "initialized", tx: sig, sgt_group: group.toBase58(), treasury_ata: treasuryAta.toBase58(), global_daily_cap: cap }));
