import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createMint, createAccount, mintTo,
  getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { createHash } from "crypto";
import { expect } from "chai";
import * as fs from "fs";
import { Adrop } from "../target/types/adrop";
import { createSgtGroup, createSgtMember } from "../scripts/sgt-mock";

const SGT_REAL_MINT = new PublicKey("5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj");
const SGT_REAL_GROUP = new PublicKey("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");

const sha256 = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest();
const nullifier = (mint: PublicKey) => Array.from(sha256(mint.toBuffer()));

describe("adrop", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.adrop as Program<Adrop>;
  const conn = provider.connection;
  const admin = (provider.wallet as anchor.Wallet).payer;

  const attester = Keypair.generate();
  const authority = Keypair.generate(); // mock SGT group + mint authority
  const viewer = Keypair.generate();
  let usdcMint: PublicKey;
  let treasuryAta: PublicKey;
  let mockGroup: PublicKey;
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const identityPda = (mint: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("identity"), sha256(mint.toBuffer())], program.programId)[0];
  const campaignPda = (id: number) =>
    PublicKey.findProgramAddressSync([Buffer.from("campaign"), new BN(id).toArrayLike(Buffer, "le", 8)], program.programId)[0];

  const register = (owner: Keypair, mint: PublicKey, tokenAccount: PublicKey, tokenProgram = TOKEN_2022_PROGRAM_ID) =>
    program.methods.registerIdentity(nullifier(mint))
      .accountsPartial({ owner: owner.publicKey, config: configPda, sgtTokenAccount: tokenAccount, sgtMint: mint, tokenProgram, identity: identityPda(mint), systemProgram: SystemProgram.programId })
      .signers([owner]).rpc();

  const expectFail = async (p: Promise<unknown>, code?: string) => {
    try { await p; } catch (e: any) {
      if (code) expect(JSON.stringify(e)).to.include(code);
      return;
    }
    expect.fail("expected the transaction to fail");
  };

  before(async () => {
    for (const k of [authority, viewer]) {
      const sig = await conn.requestAirdrop(k.publicKey, 5e9);
      await conn.confirmTransaction(sig);
    }
    usdcMint = await createMint(conn, admin, admin.publicKey, null, 6);
    treasuryAta = (await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, admin.publicKey)).address;
    mockGroup = await createSgtGroup(conn, authority, authority);
  });

  describe("initialize", () => {
    it("stores config", async () => {
      await program.methods.initialize(attester.publicKey, mockGroup, usdcMint, 10)
        .accountsPartial({ admin: admin.publicKey, config: configPda, protocolTreasuryAta: treasuryAta, systemProgram: SystemProgram.programId })
        .rpc();
      const c = await program.account.config.fetch(configPda);
      expect(c.admin.equals(admin.publicKey)).to.be.true;
      expect(c.attester.equals(attester.publicKey)).to.be.true;
      expect(c.sgtGroup.equals(mockGroup)).to.be.true;
      expect(c.globalDailyCap).to.eq(10);
    });
  });

  describe("register_identity", () => {
    it("registers with a mock SGT", async () => {
      const { mint, tokenAccount } = await createSgtMember(conn, authority, authority, mockGroup, viewer.publicKey);
      await register(viewer, mint, tokenAccount);
      const id = await program.account.identity.fetch(identityPda(mint));
      expect(id.owner.equals(viewer.publicKey)).to.be.true;
      expect(id.proofType).to.eq(1);
      expect(Buffer.from(id.proofNullifier).equals(sha256(mint.toBuffer()))).to.be.true;
      expect(id.viewsToday).to.eq(0);
    });

    it("rejects a second identity for the same mint", async () => {
      const { mint, tokenAccount } = await createSgtMember(conn, authority, authority, mockGroup, viewer.publicKey);
      await register(viewer, mint, tokenAccount);
      await expectFail(register(viewer, mint, tokenAccount));
    });

    it("rejects an SGT from another group", async () => {
      const otherGroup = await createSgtGroup(conn, authority, authority);
      const { mint, tokenAccount } = await createSgtMember(conn, authority, authority, otherGroup, viewer.publicKey);
      await expectFail(register(viewer, mint, tokenAccount), "SgtWrongMetadataPointer");
    });

    it("rejects a zero-balance SGT account", async () => {
      const { mint, tokenAccount } = await createSgtMember(conn, authority, authority, mockGroup, viewer.publicKey, 0);
      await expectFail(register(viewer, mint, tokenAccount), "SgtZeroBalance");
    });

    it("rejects a legacy SPL token", async () => {
      const mint = await createMint(conn, authority, authority.publicKey, null, 0);
      const tokenAccount = await createAccount(conn, authority, mint, viewer.publicKey);
      await mintTo(conn, authority, mint, tokenAccount, authority, 1);
      await expectFail(register(viewer, mint, tokenAccount, TOKEN_PROGRAM_ID), "SgtWrongTokenProgram");
    });

    it("rejects an SGT owned by someone else", async () => {
      const { mint, tokenAccount } = await createSgtMember(conn, authority, authority, mockGroup, authority.publicKey);
      await expectFail(register(viewer, mint, tokenAccount), "SgtNotOwned");
    });
  });

  describe("register_identity on the real SGT mint (mainnet fixture)", () => {
    // Config points at the mock group, so the real SGT is rejected on the group check here;
    // the point is that both extensions parse from real mint data. A config with the real group
    // is covered by the mock, whose layout mirrors it.
    it("parses the real mint extensions and rejects the foreign group", async () => {
      const holder = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("tests/fixtures/sgt-holder.json", "utf8"))));
      const sig = await conn.requestAirdrop(holder.publicKey, 1e9);
      await conn.confirmTransaction(sig);
      const ata = getAssociatedTokenAddressSync(SGT_REAL_MINT, holder.publicKey, false, TOKEN_2022_PROGRAM_ID);
      await expectFail(register(holder, SGT_REAL_MINT, ata), "SgtWrongMetadataPointer");
      const c = await program.account.config.fetch(configPda);
      expect(c.sgtGroup.equals(SGT_REAL_GROUP)).to.be.false;
    });
  });

  describe("campaigns", () => {
    const root = Array.from(sha256(Buffer.from("segment")));
    const advertiser = Keypair.generate().publicKey;
    const escrowOf = (id: number) => getAssociatedTokenAddressSync(usdcMint, campaignPda(id), true);

    const create = (id: number, price = 100_000) =>
      program.methods.createCampaign(new BN(id), advertiser, root, new BN(price), 3000, 1)
        .accountsPartial({ payer: admin.publicKey, config: configPda, campaign: campaignPda(id), usdcMint, escrowAta: escrowOf(id), tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();
    const activate = (id: number) =>
      program.methods.activateCampaign()
        .accountsPartial({ config: configPda, campaign: campaignPda(id), escrowAta: escrowOf(id), tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();

    it("creates a Draft campaign with an escrow ATA", async () => {
      await create(1);
      const c = await program.account.campaign.fetch(campaignPda(1));
      expect(c.id.toNumber()).to.eq(1);
      expect(c.advertiser.equals(advertiser)).to.be.true;
      expect(c.status).to.deep.eq({ draft: {} });
      expect(c.pricePerView.toNumber()).to.eq(100_000);      expect((await conn.getTokenAccountBalance(escrowOf(1))).value.amount).to.eq("0");
    });

    it("rejects a zero price", async () => {
      await expectFail(create(2, 0), "ZeroPrice");
    });

    it("rejects activation while underfunded, then activates once funded", async () => {
      await expectFail(activate(1), "EscrowUnderfunded");
      await mintTo(conn, admin, usdcMint, escrowOf(1), admin, 1_000_000);
      await activate(1);
      const c = await program.account.campaign.fetch(campaignPda(1));
      expect(c.status).to.deep.eq({ active: {} });
      expect(c.budget.toNumber()).to.eq(1_000_000);
    });

    it("rejects activating twice", async () => {
      await expectFail(activate(1), "WrongCampaignStatus");
    });
  });
});
