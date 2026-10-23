import request from "supertest";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { keepFunded } from "../src/keep-funded.js";
import { identity, testDeps } from "./fakes.js";

const w = () => Keypair.generate().publicKey.toBase58();
const ids = [identity(w()), identity(w())];
const deps = testDeps(ids);
const app = createApp({ ...deps, helius: { findSgt: async () => null }, sgtGroup: w(), demoCampaignId: () => 1 });
const body = { advertiser: w(), tags: [], price_per_view: 500_000, budget: 5_000_000, creative: { image_url: "https://x.test/a.png", title: "Hi", cta_url: "https://x.test" } };
const DAY = 86_400_000;

describe("console", () => {
  it("GET /campaigns lists with spent and views from paid impressions", async () => {
    await request(app).post("/campaigns").send(body);
    const now = Date.now();
    const ins = deps.db.prepare("INSERT INTO impressions (id, nonce, campaign_id, identity, viewer, host_ata, issued_at, expires_at, status, tx) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)");
    ins.run("i1", "n1", ids[0].address, ids[0].owner, deps.hostAtas[0], now - 2 * DAY, now, "paid", "tx1");
    ins.run("i2", "n2", ids[1].address, ids[1].owner, deps.hostAtas[0], now, now, "paid", "tx2");
    ins.run("i3", "n3", ids[1].address, ids[1].owner, deps.hostAtas[0], now, now, "issued", null);
    const res = await request(app).get("/campaigns");
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: 1, status: "draft", spent: 1_000_000, views_today: 1, reachable: 2, tags: [] });
    expect(res.body[0].escrow_ata).toBeTypeOf("string");
  });

  it("GET /campaigns/:id/activity returns a 7-day series and the last payouts", async () => {
    const res = await request(app).get("/campaigns/1/activity");
    expect(res.status).toBe(200);
    expect(res.body.series).toHaveLength(7);
    expect(res.body.series[6].views).toBe(1);
    expect(res.body.series[4].views).toBe(1);
    expect(res.body.payouts.map((p: any) => p.tx)).toEqual(["tx2", "tx1"]);
    expect((await request(app).get("/campaigns/9/activity")).status).toBe(404);
  });

  it("GET /stats counts apps, people, views this week and names the demo campaign", async () => {
    const res = await request(app).get("/stats");
    expect(res.body).toMatchObject({ apps: 1, people: 2, views_week: 2, demo_campaign_id: 1, split_bps: { viewer: 7000, host: 2000, protocol: 1000 } });
  });

  it("keepFunded creates and funds a campaign only when none has budget left", async () => {
    const calls: string[] = [];
    const advertiser = w();
    const f = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url}`);
      if (url.endsWith("/campaigns")) { const r = await request(app).post("/campaigns").send(JSON.parse(String(init!.body))); return new Response(JSON.stringify(r.body), { status: r.status }); }
      const id = Number(url.split("/").pop()); deps.campaigns.get(id).status = "active"; deps.campaigns.get(id).budget = 5_000_000;
      deps.db.prepare("UPDATE campaigns SET status = 'active' WHERE id = ?").run(id);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const k = keepFunded({ db: deps.db, chain: deps.chain, baseUrl: "http://test", usdcMint: deps.usdcMint, advertiser, fetch: f, log: () => {} });
    expect(await k.ensure()).toBe(2);
    expect(calls).toEqual(["POST http://test/campaigns", "POST http://test/demo/fund/2"]);
    expect(await k.ensure()).toBe(2);
    expect(calls).toHaveLength(2);
    deps.campaigns.get(2).spent = 4_000_000; // under 5 views left
    expect(await k.ensure()).toBe(3);
  });
});
