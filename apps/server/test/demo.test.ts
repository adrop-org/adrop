import request from "supertest";
import { Keypair } from "@solana/web3.js";
import { expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { MAX_DEMO_MINTS } from "../src/routes/demo.js";
import { testDeps } from "./fakes.js";

it("demo fund: 503 without the demo agent key", async () => {
  delete process.env.X402_DEMO_SECRET;
  const app = createApp({ ...testDeps([]), helius: { findSgt: async () => null }, sgtGroup: Keypair.generate().publicKey.toBase58() });
  const r = await request(app).post("/demo/fund/1");
  expect(r.status).toBe(503);
  expect(r.body.error).toBe("demo_agent_not_configured");
});

const w = () => Keypair.generate().publicKey.toBase58();

it("demo mint-sgt: one token per wallet, 503 without a minter, 400 on a bad wallet, capped", async () => {
  const group = w();
  const bare = createApp({ ...testDeps([]), helius: { findSgt: async () => null }, sgtGroup: group });
  expect((await request(bare).post("/demo/mint-sgt").send({ wallet: w() })).status).toBe(503);

  const deps = testDeps([]);
  let calls = 0;
  const app = createApp({ ...deps, helius: { findSgt: async () => null }, sgtGroup: group, mintSgt: async (x) => { calls++; return `mint-for-${x}`; } });
  const a = w();
  const first = await request(app).post("/demo/mint-sgt").send({ wallet: a });
  expect(first.status).toBe(200);
  expect(first.body).toEqual({ mint: `mint-for-${a}` });
  const again = await request(app).post("/demo/mint-sgt").send({ wallet: a });
  expect(again.body).toEqual({ mint: `mint-for-${a}`, already: true });
  expect(calls).toBe(1);
  expect((await request(app).post("/demo/mint-sgt").send({ wallet: "nope" })).status).toBe(400);

  const ins = deps.db.prepare("INSERT OR IGNORE INTO demo_mints (wallet, mint, created_at) VALUES (?, 'm', 0)");
  for (let i = 0; i < MAX_DEMO_MINTS; i++) ins.run(`filler${i}`);
  expect((await request(app).post("/demo/mint-sgt").send({ wallet: w() })).status).toBe(429);
});
