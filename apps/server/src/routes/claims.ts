// SPEC §4: /impressions, /claims, /claims/:id/submit. The attestation is the attester's signature on pay_view.
import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { merkleProof } from "@adrop/shared";
import type { Db } from "../db.js";
import type { ChainLike } from "../chain.js";
import { sha256 } from "../chain.js";
import { verify } from "../ed25519.js";

export type ClaimDeps = { db: Db; chain: ChainLike; usdcMint: string; treasuryAta: string; globalDailyCap: number; now?: () => number };

export const NONCE_TTL_MS = 10 * 60_000;
const pubkey = z.string().refine((s) => { try { new PublicKey(s); return true; } catch { return false; } }, "invalid pubkey");
const dayOf = (ms: number) => Math.floor(ms / 86_400_000);
const hexToBytes = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

const Attention = z.object({
  visible_ms: z.number().int().min(0),
  max_visibility: z.number().min(0).max(1),
  focused: z.boolean(),
  pointer_event_ts: z.number().int().positive(),
  scroll_before_click: z.boolean().optional(),
});

export function claimRoutes({ db, chain, usdcMint, treasuryAta, globalDailyCap, now = Date.now }: ClaimDeps) {
  const r = Router();
  const mint = new PublicKey(usdcMint);
  const treasury = new PublicKey(treasuryAta);
  const q = {
    activeCampaigns: db.prepare("SELECT * FROM campaigns WHERE status = 'active'"),
    countToday: db.prepare("SELECT COUNT(*) AS n FROM impressions WHERE identity = ? AND campaign_id = ? AND status IN ('claimed','paid') AND issued_at >= ?"),
    pendingToday: db.prepare("SELECT COUNT(*) AS n FROM impressions WHERE identity = ? AND status = 'claimed' AND issued_at >= ?"),
    insert: db.prepare("INSERT INTO impressions (id, nonce, campaign_id, identity, viewer, host_ata, issued_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued')"),
    get: db.prepare("SELECT * FROM impressions WHERE id = ?"),
    getByClaim: db.prepare("SELECT * FROM impressions WHERE claim_id = ?"),
    campaign: db.prepare("SELECT * FROM campaigns WHERE id = ?"),
    claim: db.prepare("UPDATE impressions SET status = 'claimed', claim_id = ?, audit_hash = ?, tx = ? WHERE id = ?"),
    paid: db.prepare("UPDATE impressions SET status = 'paid', tx = ? WHERE id = ?"),
  };

  r.post("/impressions", async (req, res, next) => {
    try {
      const b = z.object({ identity_wallet: pubkey, host_ata: pubkey, campaign_id: z.number().int().positive().optional() }).parse(req.body);
      const id = await chain.findIdentityByOwner(new PublicKey(b.identity_wallet));
      if (!id) return res.status(404).json({ error: "not_registered" });
      const t = now();
      const dayStart = dayOf(t) * 86_400_000;
      const onChainToday = id.lastDay === Math.floor(t / 1000 / 86_400) ? (id.viewsToday ?? 0) : 0;
      const pending = (q.pendingToday.get(id.address, dayStart) as { n: number }).n;
      if (onChainToday + pending >= globalDailyCap) return res.status(429).json({ error: "global_cap_reached", views_today: onChainToday + pending });
      const leaf = Buffer.from(sha256(id.nullifier)).toString("hex");
      const candidates = (q.activeCampaigns.all() as any[])
        .filter((c) => !b.campaign_id || c.id === b.campaign_id)
        .filter((c) => (JSON.parse(c.leaves) as { leaf: string }[]).some((l) => l.leaf === leaf))
        .filter((c) => (q.countToday.get(id.address, c.id, dayStart) as { n: number }).n < c.freq_cap);
      let chosen: any = null;
      for (const c of candidates) {
        const on = await chain.fetchCampaign(c.id, mint);
        if (on && on.status === "active" && on.budget - on.spent >= c.price_per_view) { chosen = c; break; }
      }
      if (!chosen) return res.status(404).json({ error: "no_campaign" });
      const impression_id = randomUUID();
      const nonce = randomBytes(32).toString("hex");
      const expires_at = t + NONCE_TTL_MS;
      q.insert.run(impression_id, nonce, chosen.id, id.address, b.identity_wallet, b.host_ata, t, expires_at);
      res.status(201).json({ impression_id, nonce, campaign: { id: chosen.id, creative: JSON.parse(chosen.creative), min_dwell_ms: chosen.min_dwell_ms, price_per_view: chosen.price_per_view }, expires_at });
    } catch (e) { next(e); }
  });

  r.post("/claims", async (req, res, next) => {
    try {
      const b = z.object({ impression_id: z.string().uuid(), nonce: z.string().length(64), attention: Attention, wallet_signature_of_nonce: z.string().min(64) }).parse(req.body);
      const row = q.get.get(b.impression_id) as any;
      if (!row || row.nonce !== b.nonce) return res.status(404).json({ error: "unknown_impression" });
      if (row.status === "paid") return res.status(409).json({ error: "already_paid", tx: row.tx });
      const t = now();
      if (t > row.expires_at) return res.status(410).json({ error: "expired" });
      const c = q.campaign.get(row.campaign_id) as any;
      const a = b.attention;
      const failed = [
        a.visible_ms < c.min_dwell_ms && "dwell",
        a.max_visibility < 0.5 && "visibility",
        !a.focused && "focus",
        (a.pointer_event_ts < row.issued_at || a.pointer_event_ts > t + 5_000) && "pointer",
      ].filter(Boolean);
      if (failed.length) return res.status(422).json({ error: "attention_failed", checks: failed });
      const viewer = new PublicKey(row.viewer);
      if (!verify(Buffer.from(b.nonce, "utf8"), Buffer.from(b.wallet_signature_of_nonce, "base64"), viewer.toBytes())) return res.status(401).json({ error: "bad_signature" });
      const leaves = (JSON.parse(c.leaves) as { leaf: string }[]).map((l) => hexToBytes(l.leaf));
      const identity = await chain.findIdentityByOwner(viewer);
      if (!identity) return res.status(404).json({ error: "not_registered" });
      const leaf = sha256(identity.nullifier);
      const index = leaves.findIndex((l) => Buffer.from(l).equals(leaf));
      if (index < 0) return res.status(403).json({ error: "not_in_segment" });
      const nonceHash = sha256(hexToBytes(b.nonce));
      const built = await chain.buildPayViewTx({ viewer, identity: new PublicKey(identity.address), campaignId: c.id, nonceHash, proof: merkleProof(leaves, index), hostAta: new PublicKey(row.host_ata), usdcMint: mint, treasuryAta: treasury });
      const claim_id = row.claim_id ?? randomUUID();
      const audit = Buffer.from(sha256(Buffer.concat([Buffer.from(String(c.id)), Buffer.from(b.nonce), Buffer.from(identity.address), Buffer.from(row.host_ata), Buffer.from(String(c.price_per_view))]))).toString("hex");
      q.claim.run(claim_id, audit, built.message_hash, row.id); // tx column holds the message hash until paid
      res.json({ claim_id, tx_base64: built.tx_base64, expires_at: row.expires_at });
    } catch (e) { next(e); }
  });

  r.post("/claims/:id/submit", async (req, res, next) => {
    try {
      const { signed_tx_base64 } = z.object({ signed_tx_base64: z.string().min(1) }).parse(req.body);
      const row = q.getByClaim.get(req.params.id) as any;
      if (!row) return res.status(404).json({ error: "unknown_claim" });
      if (row.status === "paid") return res.status(409).json({ error: "already_paid", tx: row.tx });
      let tx: string;
      try { tx = await chain.sendSignedTx(signed_tx_base64, row.tx); } catch (e: any) { return res.status(400).json({ error: "submit_failed", message: e?.message ?? String(e) }); }
      q.paid.run(tx, row.id);
      res.json({ tx, impression_id: row.id, campaign_id: row.campaign_id });
    } catch (e) { next(e); }
  });

  return r;
}
