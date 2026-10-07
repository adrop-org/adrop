import request from "supertest";
import { Keypair, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { sign } from "../src/ed25519.js";
import { HOST_ATA, identity, testDeps } from "./fakes.js";

const viewer = Keypair.generate();
const other = Keypair.generate();
const ids = [identity(viewer.publicKey.toBase58()), identity(other.publicKey.toBase58())];
let clock = 1_700_000_000_000;
const deps = testDeps(ids);
const app = createApp({ ...deps, now: () => clock, helius: { findSgt: async () => null }, sgtGroup: "x" });
const hostAta = HOST_ATA;
const creative = { image_url: "https://x.test/a.png", title: "Hi", cta_url: "https://x.test" };
const attention = (issued: number) => ({ visible_ms: 3500, max_visibility: 0.9, focused: true, pointer_event_ts: issued + 3600, scroll_before_click: true });
const signNonce = (kp: Keypair, nonce: string) => Buffer.from(sign(Buffer.from(nonce, "utf8"), kp.secretKey)).toString("base64");

async function setup() {
  deps.db.prepare("INSERT INTO segments (tag, wallet) VALUES (?, ?)").run("t", viewer.publicKey.toBase58());
  const c = await request(app).post("/campaigns").send({ advertiser: hostAta, tags: ["t"], price_per_view: 100_000, budget: 500_000, creative });
  deps.db.prepare("UPDATE campaigns SET status = 'active' WHERE id = ?").run(c.body.campaign_id);
  deps.campaigns.set(c.body.campaign_id, { id: c.body.campaign_id, status: "active", budget: 500_000, spent: 0 });
  return c.body.campaign_id as number;
}
const impression = () => request(app).post("/impressions").send({ identity_wallet: viewer.publicKey.toBase58(), host_ata: hostAta });

describe("impressions and claims", () => {
  it("rejects unknown and out-of-segment identities", async () => {
    await setup();
    expect((await request(app).post("/impressions").send({ identity_wallet: Keypair.generate().publicKey.toBase58(), host_ata: hostAta })).status).toBe(404);
    const r = await request(app).post("/impressions").send({ identity_wallet: other.publicKey.toBase58(), host_ata: hostAta });
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("no_campaign");
  });

  it("issues an impression, then claim -> sign -> submit pays", async () => {
    const imp = await impression();
    expect(imp.status).toBe(201);
    expect(imp.body.campaign).toMatchObject({ id: 1, min_dwell_ms: 3000, price_per_view: 100_000, creative });
    expect(imp.body.nonce).toHaveLength(64);
    const issued = clock; clock += 4000;
    const claim = await request(app).post("/claims").send({ impression_id: imp.body.impression_id, nonce: imp.body.nonce, attention: attention(issued), wallet_signature_of_nonce: signNonce(viewer, imp.body.nonce) });
    expect(claim.status, JSON.stringify(claim.body)).toBe(200);
    const args = deps.calls.buildPayViewTx[0][0] as any;
    expect(args.campaignId).toBe(1);
    expect(args.proof).toEqual([]); // one-leaf tree
    const tx = Transaction.from(Buffer.from(claim.body.tx_base64, "base64"));
    tx.partialSign(viewer);
    const sub = await request(app).post(`/claims/${claim.body.claim_id}/submit`).send({ signed_tx_base64: tx.serialize().toString("base64") });
    expect(sub.status, JSON.stringify(sub.body)).toBe(200);
    expect(sub.body.tx).toBe("pay-tx");
    expect((await request(app).post(`/claims/${claim.body.claim_id}/submit`).send({ signed_tx_base64: tx.serialize().toString("base64") })).status).toBe(409);
  });

  it("enforces the per-campaign freq cap, then the global cap", async () => {
    const r = await impression(); // freq_cap 1 on campaign 1 -> no campaign
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("no_campaign");
  });

  it("rejects a host account that is not allow-listed (MF-1)", async () => {
    const r = await request(app).post("/impressions").send({ identity_wallet: viewer.publicKey.toBase58(), host_ata: Keypair.generate().publicKey.toBase58() });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("unknown_host");
  });

  it("rejects a claim before min_dwell_ms has elapsed since issue (MF-2)", async () => {
    deps.db.prepare("UPDATE campaigns SET freq_cap = 5").run();
    const imp = await impression();
    expect(imp.status).toBe(201);
    const issued = clock; clock += 1000;
    const r = await request(app).post("/claims").send({ impression_id: imp.body.impression_id, nonce: imp.body.nonce, attention: attention(issued), wallet_signature_of_nonce: signNonce(viewer, imp.body.nonce) });
    expect(r.status).toBe(422);
    expect(r.body.checks).toEqual(["elapsed"]);
    clock += 3000;
    const ok = await request(app).post("/claims").send({ impression_id: imp.body.impression_id, nonce: imp.body.nonce, attention: attention(issued), wallet_signature_of_nonce: signNonce(viewer, imp.body.nonce) });
    expect(ok.status).toBe(200);
  });

  it("rejects failed attention, bad signature, reused nonce and expiry", async () => {
    deps.db.prepare("UPDATE campaigns SET freq_cap = 5").run();
    const imp = await impression();
    expect(imp.status).toBe(201);
    const issued = clock; clock += 4000;
    const base = { impression_id: imp.body.impression_id, nonce: imp.body.nonce, wallet_signature_of_nonce: signNonce(viewer, imp.body.nonce) };
    let r = await request(app).post("/claims").send({ ...base, attention: { ...attention(issued), visible_ms: 1000, focused: false } });
    expect(r.status).toBe(422);
    expect(r.body.checks).toEqual(["dwell", "focus"]);
    r = await request(app).post("/claims").send({ ...base, attention: attention(issued), wallet_signature_of_nonce: signNonce(other, imp.body.nonce) });
    expect(r.status).toBe(401);
    r = await request(app).post("/claims").send({ ...base, nonce: "00".repeat(32), attention: attention(issued) });
    expect(r.status).toBe(404);
    clock += 11 * 60_000;
    r = await request(app).post("/claims").send({ ...base, attention: attention(issued) });
    expect(r.status).toBe(410);
  });

  it("submit rejects a swapped or unsigned transaction", async () => {
    const imp = await impression();
    const issued = clock; clock += 4000;
    const claim = await request(app).post("/claims").send({ impression_id: imp.body.impression_id, nonce: imp.body.nonce, attention: attention(issued), wallet_signature_of_nonce: signNonce(viewer, imp.body.nonce) });
    expect(claim.status).toBe(200);
    const unsigned = await request(app).post(`/claims/${claim.body.claim_id}/submit`).send({ signed_tx_base64: claim.body.tx_base64 });
    expect(unsigned.status).toBe(400);
    const otherTx = Transaction.from(Buffer.from(claim.body.tx_base64, "base64"));
    otherTx.recentBlockhash = Keypair.generate().publicKey.toBase58();
    otherTx.signatures = [];
    const swapped = await request(app).post(`/claims/${claim.body.claim_id}/submit`).send({ signed_tx_base64: otherTx.serialize({ requireAllSignatures: false }).toString("base64") });
    expect(swapped.status).toBe(400);
  });

  it("global cap: 2 pending claims block a third impression", async () => {
    // one claimed (unpaid) impression from the test above + one paid view the chain reports today
    ids[0].viewsToday = 1; ids[0].lastDay = Math.floor(clock / 1000 / 86_400);
    const r = await impression();
    expect(r.status).toBe(429);
  });
});
