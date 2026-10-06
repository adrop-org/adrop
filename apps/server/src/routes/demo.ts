import { Router } from "express";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { X402_NETWORK_DEVNET } from "@adrop/shared";

// Demo only, removed with the demo app: pays /campaigns/:id/fund over x402 as the demo agent wallet,
// so the advertiser page can fund a campaign without a terminal. Needs X402_DEMO_SECRET (JSON keypair).
export function demoRoutes({ baseUrl, rpcUrl }: { baseUrl: string; rpcUrl?: string }) {
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
  return r;
}
