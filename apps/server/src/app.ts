import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { identityRoutes, type IdentityDeps } from "./routes/identity.js";
import { campaignRoutes, type CampaignDeps } from "./routes/campaigns.js";
import { claimRoutes, type ClaimDeps } from "./routes/claims.js";

export type AppDeps = IdentityDeps & CampaignDeps & ClaimDeps;

export function createApp(deps: AppDeps) {
  const app = express();
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
