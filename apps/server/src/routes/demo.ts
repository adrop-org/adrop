import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { X402_NETWORK_DEVNET } from "@adrop/shared";
import type { Db } from "../db.js";

export const MAX_DEMO_MINTS = 200; // about 0.8 SOL of devnet fee-payer funds

// Demo only, removed with the demo app: pays /campaigns/:id/fund over x402 as the demo agent wallet,
// so the advertiser page can fund a campaign without a terminal. Needs X402_DEMO_SECRET (JSON keypair).
export function demoRoutes({ baseUrl, rpcUrl, mintSgt, db }: { baseUrl: string; rpcUrl?: string; mintSgt?: (wallet: string) => Promise<string>; db: Db }) {
  const r = Router();
  r.post("/demo/fund/:id", async (req, res, next) => {
    try {
      const secret = process.env.X402_DEMO_SECRET;
      if (!secret) return res.status(503).json({ error: "demo_agent_not_configured" });
      const signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(secret)));
      const pay = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: X402_NETWORK_DEVNET, client: new ExactSvmScheme(signer, { rpcUrl }) }] });
      const out = await pay(`${baseUrl}/campaigns/${Number(req.params.id)}/fund`, { method: "POST" });
      res.status(out.status).json(await out.json());
    } catch (e) { next(e); }
  });
  // Devnet only: one mock Genesis Token per wallet (saved in demo_mints), so visitors can opt in without the Adrop team.
  r.post("/demo/mint-sgt", async (req, res, next) => {
    try {
      if (!mintSgt) return res.status(503).json({ error: "demo_mint_not_configured" });
      const wallet = String(req.body?.wallet ?? "");
      try { new PublicKey(wallet); } catch { return res.status(400).json({ error: "bad_wallet" }); }
      const have = db.prepare("SELECT mint FROM demo_mints WHERE wallet = ?").get(wallet) as { mint: string | null } | undefined;
      if (have) return res.json({ mint: have.mint, already: true });
      if ((db.prepare("SELECT COUNT(*) AS n FROM demo_mints").get() as { n: number }).n >= MAX_DEMO_MINTS) return res.status(429).json({ error: "demo_mint_limit" });
      db.prepare("INSERT INTO demo_mints (wallet, created_at) VALUES (?, ?)").run(wallet, Date.now()); // reserved before the slow mint: a double click mints once
      try {
        const mint = await mintSgt(wallet);
        db.prepare("UPDATE demo_mints SET mint = ? WHERE wallet = ?").run(mint, wallet);
        res.json({ mint });
      } catch (e) { db.prepare("DELETE FROM demo_mints WHERE wallet = ?").run(wallet); throw e; }
    } catch (e) { next(e); }
  });
  return r;
}
