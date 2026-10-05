import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { identityRoutes, type IdentityDeps } from "./routes/identity.js";
import { campaignRoutes, type CampaignDeps } from "./routes/campaigns.js";
import { claimRoutes, type ClaimDeps } from "./routes/claims.js";

export type AppDeps = IdentityDeps & CampaignDeps & ClaimDeps;

export function createApp(deps: AppDeps) {
  const app = express();
  // Host apps call the API cross-origin from the SDK; x402 clients need the payment headers exposed.
  app.use((req, res, next) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type, payment-signature, payment-required");
    res.setHeader("access-control-expose-headers", "payment-required, payment-response");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(identityRoutes(deps));
  app.use(campaignRoutes(deps));
  app.use(claimRoutes(deps));
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) return res.status(400).json({ error: "bad_request", issues: err.issues });
    console.error(err);
    res.status(500).json({ error: "internal", message: err?.message ?? String(err) });
  };
  app.use(onError);
  return app;
}
