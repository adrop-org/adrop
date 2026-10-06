import request from "supertest";
import { Keypair } from "@solana/web3.js";
import { expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { testDeps } from "./fakes.js";

it("demo fund: 503 without the demo agent key", async () => {
  delete process.env.X402_DEMO_SECRET;
  const app = createApp({ ...testDeps([]), helius: { findSgt: async () => null }, sgtGroup: Keypair.generate().publicKey.toBase58() });
  const r = await request(app).post("/demo/fund/1");
  expect(r.status).toBe(503);
  expect(r.body.error).toBe("demo_agent_not_configured");
});
