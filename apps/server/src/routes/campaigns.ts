import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { merkleRoot } from "@adrop/shared";
import type { Db } from "../db.js";
import type { ChainLike } from "../chain.js";
import type { X402 } from "../x402.js";
import { segmentLeaves } from "../segments.js";

export type CampaignDeps = { db: Db; chain: ChainLike; x402: X402; usdcMint: string; baseUrl: string };

const pubkey = z.string().refine((s) => { try { new PublicKey(s); return true; } catch { return false; } }, "invalid pubkey");
const CreateBody = z.object({
  advertiser: pubkey,
  tags: z.array(z.string().min(1)).min(1),
  price_per_view: z.number().int().positive(),
  min_dwell_ms: z.number().int().min(500).default(3000),
  freq_cap: z.number().int().min(1).max(255).default(1),
  creative: z.object({ image_url: z.string().url(), title: z.string().min(1).max(80), cta_url: z.string().url() }),
  budget: z.number().int().positive(),
});
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

export function campaignRoutes({ db, chain, x402, usdcMint, baseUrl }: CampaignDeps) {
  const r = Router();
  const mint = new PublicKey(usdcMint);
  const getRow = db.prepare("SELECT * FROM campaigns WHERE id = ?");

  r.post("/campaigns", async (req, res, next) => {
    try {
      const b = CreateBody.parse(req.body);
      if (b.budget < b.price_per_view) return res.status(400).json({ error: "budget_below_price" });
      const members = await segmentLeaves(b.tags, db, chain);
      const root = merkleRoot(members.map((m) => m.leaf));
      const id = (db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM campaigns").get() as { id: number }).id;
      const tx = await chain.createCampaign(id, new PublicKey(b.advertiser), root, b.price_per_view, b.min_dwell_ms, b.freq_cap, mint);
      db.prepare(`INSERT INTO campaigns (id, advertiser, tags, price_per_view, min_dwell_ms, freq_cap, budget, creative, segment_root, leaves, status, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`)
        .run(id, b.advertiser, JSON.stringify(b.tags), b.price_per_view, b.min_dwell_ms, b.freq_cap, b.budget, JSON.stringify(b.creative), hex(root), JSON.stringify(members.map((m) => ({ wallet: m.wallet, leaf: hex(m.leaf) }))), Date.now());
      res.status(201).json({ campaign_id: id, escrow_ata: chain.escrowAta(id, mint).toBase58(), segment_root: hex(root), reachable: members.length, create_tx: tx, fund_url: `${baseUrl}/campaigns/${id}/fund` });
    } catch (e) { next(e); }
  });

  r.get("/campaigns/:id", async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const row = getRow.get(id) as any;
      if (!row) return res.status(404).json({ error: "not_found" });
      const onchain = await chain.fetchCampaign(id, mint);
      res.json({ id, advertiser: row.advertiser, tags: JSON.parse(row.tags), price_per_view: row.price_per_view, min_dwell_ms: row.min_dwell_ms, freq_cap: row.freq_cap, budget: row.budget, creative: JSON.parse(row.creative), segment_root: row.segment_root, reachable: JSON.parse(row.leaves).length, status: onchain?.status ?? row.status, spent: onchain?.spent ?? 0, escrow_ata: chain.escrowAta(id, mint).toBase58() });
    } catch (e) { next(e); }
  });

  // x402 exact: amount = budget, payTo = fee payer; settle -> forward to escrow -> activate.
  r.post("/campaigns/:id/fund", async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const row = getRow.get(id) as any;
      if (!row) return res.status(404).json({ error: "not_found" });
      if (row.status !== "draft") return res.status(409).json({ error: "already_funded", status: row.status });
      const paid = await x402.charge(req, res, `POST /campaigns/${id}/fund`, row.budget, `Fund adrop campaign ${id}`);
      if (!paid) return;
      db.prepare("UPDATE campaigns SET status = 'funded' WHERE id = ?").run(id);
      let activate_tx: string;
      try {
        activate_tx = await chain.fundAndActivate(id, row.budget, mint);
      } catch (e: any) {
        return res.status(500).json({ error: "activation_failed", settle_tx: paid.tx, message: e?.message ?? String(e) });
      }
      db.prepare("UPDATE campaigns SET status = 'active' WHERE id = ?").run(id);
      for (const [k, v] of Object.entries(paid.headers)) res.setHeader(k, v);
      res.json({ status: "active", campaign_id: id, settle_tx: paid.tx, activate_tx, payer: paid.payer });
    } catch (e) { next(e); }
  });

  return r;
}
