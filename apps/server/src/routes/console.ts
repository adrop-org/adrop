import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import type { Db } from "../db.js";
import type { ChainLike } from "../chain.js";

// Read-only routes for the console app (app.adrop.sh). Additive: nothing the demo app calls changes.
export type ConsoleDeps = { db: Db; chain: ChainLike; usdcMint: string; hostAtas: string[]; demoCampaignId?: () => number | undefined; demoAdvertiser?: string; now?: () => number };

// Mirrors programs/adrop/src/instructions/pay_view.rs (VIEWER_BPS); the rest goes 20 host / 10 protocol.
export const SPLIT_BPS = { viewer: 7000, host: 2000, protocol: 1000 };
const DAY = 86_400_000;

export function consoleRoutes({ db, chain, usdcMint, hostAtas, demoCampaignId, demoAdvertiser, now = Date.now }: ConsoleDeps) {
  const r = Router();
  const mint = new PublicKey(usdcMint);
  const q = {
    list: db.prepare("SELECT * FROM campaigns ORDER BY id DESC LIMIT 50"),
    paid: db.prepare("SELECT COUNT(*) AS n FROM impressions WHERE campaign_id = ? AND status = 'paid'"),
    paidToday: db.prepare("SELECT COUNT(*) AS n FROM impressions WHERE campaign_id = ? AND status = 'paid' AND issued_at >= ?"),
    paidSince: db.prepare("SELECT COUNT(*) AS n FROM impressions WHERE status = 'paid' AND issued_at >= ?"),
    hosts: db.prepare("SELECT COUNT(DISTINCT host_ata) AS n FROM impressions WHERE status = 'paid'"),
    days: db.prepare("SELECT (issued_at / 86400000) AS day, COUNT(*) AS n FROM impressions WHERE campaign_id = ? AND status = 'paid' AND issued_at >= ? GROUP BY day"),
    payouts: db.prepare("SELECT viewer, host_ata, tx, issued_at FROM impressions WHERE campaign_id = ? AND status = 'paid' ORDER BY issued_at DESC LIMIT 10"),
  };
  let people: { n: number; at: number } | null = null;

  r.get("/stats", async (_req, res, next) => {
    try {
      const t = now();
      if (!people || t - people.at > 60_000) {
        try { people = { n: (await chain.listIdentities()).length, at: t }; } catch { people = people ?? { n: 0, at: 0 }; }
      }
      res.json({
        apps: Math.max(hostAtas.length, (q.hosts.get() as { n: number }).n),
        people: people.n,
        views_week: (q.paidSince.get(t - 7 * DAY) as { n: number }).n,
        split_bps: SPLIT_BPS,
        demo_campaign_id: demoCampaignId?.() ?? null,
        demo_advertiser: demoAdvertiser ?? null,
      });
    } catch (e) { next(e); }
  });

  r.get("/campaigns", (_req, res, next) => {
    try {
      const dayStart = Math.floor(now() / DAY) * DAY;
      const rows = (q.list.all() as any[]).map((row) => ({
        id: row.id, advertiser: row.advertiser, tags: JSON.parse(row.tags), price_per_view: row.price_per_view, freq_cap: row.freq_cap, budget: row.budget,
        creative: JSON.parse(row.creative), reachable: JSON.parse(row.leaves).length, status: row.status, created_at: row.created_at,
        // Spent from the server's own paid impressions: no RPC per row. GET /campaigns/:id has the on-chain figure.
        spent: (q.paid.get(row.id) as { n: number }).n * row.price_per_view,
        views_today: (q.paidToday.get(row.id, dayStart) as { n: number }).n,
        escrow_ata: chain.escrowAta(row.id, mint).toBase58(),
      }));
      res.json(rows);
    } catch (e) { next(e); }
  });

  r.get("/campaigns/:id/activity", (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const row = db.prepare("SELECT price_per_view FROM campaigns WHERE id = ?").get(id) as { price_per_view: number } | undefined;
      if (!row) return res.status(404).json({ error: "not_found" });
      const today = Math.floor(now() / DAY);
      const byDay = new Map((q.days.all(id, (today - 6) * DAY) as { day: number; n: number }[]).map((d) => [d.day, d.n]));
      const series = Array.from({ length: 7 }, (_, i) => ({ day: (today - 6 + i) * DAY, views: byDay.get(today - 6 + i) ?? 0 }));
      const payouts = (q.payouts.all(id) as any[]).map((p) => ({ viewer: p.viewer, host_ata: p.host_ata, tx: p.tx, at: p.issued_at, price_per_view: row.price_per_view }));
      res.json({ id, series, payouts });
    } catch (e) { next(e); }
  });
  return r;
}
