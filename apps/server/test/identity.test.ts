import request from "supertest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { Helius } from "../src/helius.js";
import type { ChainLike } from "../src/chain.js";
import { testDeps } from "./fakes.js";

const GROUP = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const SGT_MINT = "5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj";
const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const holder = Keypair.generate().publicKey.toBase58();
const ata = Keypair.generate().publicKey.toBase58();

// Fake Helius: holder has a zero-balance SGT account, a wrong-group NFT and one real SGT.
const tokenAccount = (mint: string, amount: string, pubkey: string) => ({
  pubkey, account: { owner: T22, data: { program: "spl-token-2022", parsed: { type: "account", info: { mint, owner: holder, tokenAmount: { amount, decimals: 0 } } } } },
});
const mintInfo = (mint: string, group: string) => ({
  value: { owner: T22, data: { parsed: { type: "mint", info: { extensions: [
    { extension: "metadataPointer", state: { metadataAddress: group } },
    { extension: "tokenGroupMember", state: { mint, group, memberNumber: 1 } },
  ] } } } },
});
const OTHER_MINT = Keypair.generate().publicKey.toBase58();
const fakeFetch = async (_url: string, init: { body: string }) => {
  const { method, params } = JSON.parse(init.body);
  let result: unknown;
  if (method === "getTokenAccountsByOwnerV2") {
    result = params[0] === holder
      ? { value: { accounts: [tokenAccount(SGT_MINT, "0", "zero"), tokenAccount(OTHER_MINT, "1", "other"), tokenAccount(SGT_MINT, "1", ata)], paginationKey: null } }
      : { value: { accounts: [], paginationKey: null } };
  } else if (method === "getAccountInfo") {
    result = params[0] === SGT_MINT ? mintInfo(SGT_MINT, GROUP) : mintInfo(OTHER_MINT, Keypair.generate().publicKey.toBase58());
  }
  return { json: async () => ({ jsonrpc: "2.0", id: 1, result }) };
};

const registered = new Set<string>();
const chain: ChainLike = {
  identityPda: (mint) => PublicKey.findProgramAddressSync([Buffer.from("identity"), mint.toBytes()], Keypair.generate().publicKey)[0],
  fetchIdentity: async (mint) => registered.has(mint.toBase58()) ? { owner: holder, proofType: 1, viewsToday: 3, lastDay: 0 } : null,
  buildRegisterTx: async (w, m, t) => Buffer.from(`${w.toBase58()}|${m.toBase58()}|${t.toBase58()}`).toString("base64"),
};
const app = createApp({ ...testDeps(), helius: new Helius("http://fake", fakeFetch as any), chain, sgtGroup: GROUP });

describe("identity routes", () => {
  it("GET /identity/:wallet without SGT", async () => {
    const res = await request(app).get(`/identity/${Keypair.generate().publicKey.toBase58()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ registered: false, has_sgt: false });
  });

  it("GET /identity/:wallet rejects a bad pubkey", async () => {
    expect((await request(app).get("/identity/not-a-key")).status).toBe(400);
  });

  it("register-tx finds the funded SGT, skipping zero balance and foreign group", async () => {
    const res = await request(app).post("/identity/register-tx").send({ wallet: holder });
    expect(res.status).toBe(200);
    expect(res.body.sgt_mint).toBe(SGT_MINT);
    expect(Buffer.from(res.body.tx_base64, "base64").toString()).toBe(`${holder}|${SGT_MINT}|${ata}`);
  });

  it("GET /identity/:wallet with SGT, unregistered then registered", async () => {
    let res = await request(app).get(`/identity/${holder}`);
    expect(res.body).toMatchObject({ registered: false, has_sgt: true, sgt_mint: SGT_MINT });
    registered.add(SGT_MINT);
    res = await request(app).get(`/identity/${holder}`);
    expect(res.body).toMatchObject({ registered: true, views_today: 3, owner: holder });
  });

  it("register-tx 409 when already registered, 404 without SGT", async () => {
    expect((await request(app).post("/identity/register-tx").send({ wallet: holder })).status).toBe(409);
    expect((await request(app).post("/identity/register-tx").send({ wallet: Keypair.generate().publicKey.toBase58() })).status).toBe(404);
  });
});
