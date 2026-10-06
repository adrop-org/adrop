// T13 headless end-to-end on devnet, no browser: impression -> attention -> claim -> viewer signs
// -> submit -> pay_view confirmed. Viewer = X402_DEMO_SECRET (registered demo wallet).
// Host = DEMO_HOST pubkey (its USDC ATA is created by the fee payer if missing).
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { sign } from "../src/ed25519.js";
import { loadConfig } from "../src/config.js";

const [base = "http://localhost:3000"] = process.argv.slice(2);
const cfg = loadConfig();
const conn = new Connection(cfg.rpcUrl, "confirmed");
const viewer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.X402_DEMO_SECRET!)));
const host = new PublicKey(process.env.DEMO_HOST!);
const usdc = new PublicKey(cfg.USDC_MINT);
const hostAta = (await getOrCreateAssociatedTokenAccount(conn, cfg.feePayer, usdc, host)).address;
const bal = async (owner: PublicKey) => { try { return Number((await conn.getTokenAccountBalance(getAssociatedTokenAddressSync(usdc, owner))).value.uiAmount); } catch { return 0; } };
const before = { viewer: await bal(viewer.publicKey), host: await bal(host) };

const post = async (path: string, body: unknown) => { const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
const imp = await post("/impressions", { identity_wallet: viewer.publicKey.toBase58(), host_ata: hostAta.toBase58() });
console.log("impression", imp.status, imp.body.campaign?.id, imp.body.error ?? "");
if (imp.status !== 201) process.exit(1);
const issued = Date.now();
await new Promise((r) => setTimeout(r, imp.body.campaign.min_dwell_ms + 200)); // "watch" the ad
const claim = await post("/claims", {
  impression_id: imp.body.impression_id, nonce: imp.body.nonce,
  attention: { visible_ms: Date.now() - issued, max_visibility: 1, focused: true, pointer_event_ts: Date.now(), scroll_before_click: true },
  wallet_signature_of_nonce: Buffer.from(sign(Buffer.from(imp.body.nonce, "utf8"), viewer.secretKey)).toString("base64"),
});
console.log("claim", claim.status, claim.body.claim_id ?? claim.body);
if (claim.status !== 200) process.exit(1);
const tx = Transaction.from(Buffer.from(claim.body.tx_base64, "base64"));
tx.partialSign(viewer);
const sub = await post(`/claims/${claim.body.claim_id}/submit`, { signed_tx_base64: tx.serialize().toString("base64") });
console.log("submit", sub.status, sub.body);
const after = { viewer: await bal(viewer.publicKey), host: await bal(host) };
console.log("USDC viewer", before.viewer, "->", after.viewer, "| host", before.host, "->", after.host);
