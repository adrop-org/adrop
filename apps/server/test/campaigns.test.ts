import request from "supertest";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { merkleRoot } from "@adrop/shared";
import { createApp } from "../src/app.js";
import { sha256 } from "../src/chain.js";
import { identity, testDeps } from "./fakes.js";

const w = () => Keypair.generate().publicKey.toBase58();
const ids = [identity(w()), identity(w()), identity(w())];
const deps = testDeps(ids);
deps.db.prepare("INSERT INTO segments (tag, wallet) VALUES (?, ?)").run("dex_swap_30d", ids[0].owner);
deps.db.prepare("INSERT INTO segments (tag, wallet) VALUES (?, ?)").run("dex_swap_30d", ids[2].owner);
deps.db.prepare("INSERT INTO segments (tag, wallet) VALUES (?, ?)").run("dex_swap_30d", w()); // not registered
const app = createApp({ ...deps, helius: { findSgt: async () => null }, sgtGroup: w() });
const body = { advertiser: w(), tags: ["dex_swap_30d"], price_per_view: 100_000, budget: 1_000_000, creative: { image_url: "https://x.test/a.png", title: "Hi", cta_url: "https://x.test" } };

describe("campaigns", () => {
  it("POST /campaigns builds the root over registered identities in the segment", async () => {
    const res = await request(app).post("/campaigns").send(body);
    expect(res.status).toBe(201);
    expect(res.body.campaign_id).toBe(1);
    expect(res.body.reachable).toBe(2);
    expect(res.body.fund_url).toBe("http://test/campaigns/1/fund");
    const expected = Buffer.from(merkleRoot([sha256(ids[0].nullifier), sha256(ids[2].nullifier)])).toString("hex");
    expect(res.body.segment_root).toBe(expected);
    const [id, , root, price, dwell, cap] = deps.calls.createCampaign[0] as any[];
    expect([id, Buffer.from(root).toString("hex"), price, dwell, cap]).toEqual([1, expected, 100_000, 3000, 1]);
  });

  it("POST /campaigns with no tags is untargeted: root over every registered identity", async () => {
    const res = await request(app).post("/campaigns").send({ ...body, tags: [] });
    expect(res.status).toBe(201);
    expect(res.body.reachable).toBe(3);
    expect(res.body.tags ?? []).toEqual([]);
  });

  it("POST /campaigns validates", async () => {
    expect((await request(app).post("/campaigns").send({ ...body, budget: 10 })).status).toBe(400);
    expect((await request(app).post("/campaigns").send({ ...body, creative: {} })).status).toBe(400);
  });

  it("GET /campaigns/:id merges DB and chain", async () => {
    const res = await request(app).get("/campaigns/1");
    expect(res.body).toMatchObject({ id: 1, status: "draft", reachable: 2, price_per_view: 100_000 });
    expect((await request(app).get("/campaigns/9")).status).toBe(404);
  });

  it("POST /campaigns/:id/fund without payment returns 402 with PAYMENT-REQUIRED", async () => {
    const res = await request(app).post("/campaigns/1/fund");
    expect(res.status).toBe(402);
    const header = res.headers["payment-required"];
    expect(header).toBeTruthy();
    const req = JSON.parse(Buffer.from(header, "base64").toString());
    expect(req.accepts[0]).toMatchObject({ scheme: "exact", amount: "1000000", payTo: deps.x402["deps"].payTo });
    expect(deps.calls.fundAndActivate).toHaveLength(0);
  });

  it("POST /campaigns/:id/fund with a payment settles, forwards and activates", async () => {
    // Mirror a client: take `accepts[0]` from the 402 and sign nothing (the fake facilitator settles anything).
    const required = JSON.parse(Buffer.from((await request(app).post("/campaigns/1/fund")).headers["payment-required"], "base64").toString());
    const payload = Buffer.from(JSON.stringify({ x402Version: 2, scheme: "exact", network: required.accepts[0].network, payload: { transaction: "AA==" }, accepted: required.accepts[0], resource: required.resource })).toString("base64");
    const res = await request(app).post("/campaigns/1/fund").set("PAYMENT-SIGNATURE", payload);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ status: "active", settle_tx: "settle-tx", activate_tx: "activate-tx" });
    expect(res.headers["payment-response"]).toBeTruthy();
    expect(deps.calls.fundAndActivate[0].slice(0, 2)).toEqual([1, 1_000_000]);
    expect((await request(app).post("/campaigns/1/fund")).status).toBe(409);
  });
});

describe("test_wallets (devnet demo)", () => {
  it("the named registered wallets are the audience, even outside the tag's segment", async () => {
    // ids[1] is registered but not in dex_swap_30d
    const r = await request(app).post("/campaigns").send({ ...body, tags: ["dex_swap_30d"], test_wallets: [ids[1].owner, w()] });
    expect(r.status).toBe(201);
    expect(r.body.reachable).toBe(1);
  });
  it("400 when none of the named wallets is registered", async () => {
    const r = await request(app).post("/campaigns").send({ ...body, tags: [], test_wallets: [w()] });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("test_wallets_not_registered");
  });
  it("rejects more than 5", async () => {
    expect((await request(app).post("/campaigns").send({ ...body, test_wallets: [w(), w(), w(), w(), w(), w()] })).status).toBe(400);
  });
});
