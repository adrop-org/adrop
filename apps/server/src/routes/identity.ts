import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import type { Helius } from "../helius.js";
import type { ChainLike } from "../chain.js";

export type IdentityDeps = { helius: Pick<Helius, "findSgt">; chain: Pick<ChainLike, "fetchIdentity" | "buildRegisterTx" | "identityPda" | "sendSignedTx">; sgtGroup: string };

const pubkey = z.string().refine((s) => { try { new PublicKey(s); return true; } catch { return false; } }, "invalid pubkey");

export function identityRoutes({ helius, chain, sgtGroup }: IdentityDeps) {
  const r = Router();

  r.get("/identity/:wallet", async (req, res, next) => {
    try {
      const wallet = pubkey.parse(req.params.wallet);
      const sgt = await helius.findSgt(wallet, sgtGroup);
      if (!sgt) return res.json({ registered: false, has_sgt: false });
      const id = await chain.fetchIdentity(new PublicKey(sgt.mint));
      if (!id) return res.json({ registered: false, has_sgt: true, sgt_mint: sgt.mint });
      res.json({ registered: true, has_sgt: true, sgt_mint: sgt.mint, identity: chain.identityPda(new PublicKey(sgt.mint)).toBase58(), owner: id.owner, proof_type: id.proofType, views_today: id.viewsToday });
    } catch (e) { next(e); }
  });

  r.post("/identity/register-tx", async (req, res, next) => {
    try {
      const { wallet } = z.object({ wallet: pubkey }).parse(req.body);
      const sgt = await helius.findSgt(wallet, sgtGroup);
      if (!sgt) return res.status(404).json({ error: "no_sgt", message: "wallet holds no Seeker Genesis Token" });
      const mint = new PublicKey(sgt.mint);
      if (await chain.fetchIdentity(mint)) return res.status(409).json({ error: "already_registered", sgt_mint: sgt.mint });
      const tx_base64 = await chain.buildRegisterTx(new PublicKey(wallet), mint, new PublicKey(sgt.tokenAccount));
      res.json({ tx_base64, sgt_mint: sgt.mint, identity: chain.identityPda(mint).toBase58() });
    } catch (e) { next(e); }
  });

  // The wallet signed the register tx; the server submits it (same as claims: the server always sends).
  r.post("/identity/submit", async (req, res, next) => {
    try {
      const { signed_tx_base64 } = z.object({ signed_tx_base64: z.string().min(1) }).parse(req.body);
      try { res.json({ tx: await chain.sendSignedTx(signed_tx_base64) }); } catch (e: any) { res.status(400).json({ error: "submit_failed", message: e?.message ?? String(e) }); }
    } catch (e) { next(e); }
  });

  return r;
}
