import * as anchor from "@anchor-lang/core";
import { BN, Program } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createMint, createAccount, mintTo,
  getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { createHash } from "crypto";
import { expect } from "chai";
import * as fs from "fs";
import { Adrop } from "../target/types/adrop";
import { createSgtGroup, createSgtMember } from "../scripts/sgt-mock";
import { merkleProof, merkleRoot } from "../packages/shared/src/merkle";

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
  let viewerMint: PublicKey; // mock SGT of `viewer`, registered in the first test
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
      await program.methods.initialize(attester.publicKey, mockGroup, usdcMint, 2)
        .accountsPartial({ admin: admin.publicKey, config: configPda, protocolTreasuryAta: treasuryAta, systemProgram: SystemProgram.programId })
        .rpc();
      const c = await program.account.config.fetch(configPda);
      expect(c.admin.equals(admin.publicKey)).to.be.true;
      expect(c.attester.equals(attester.publicKey)).to.be.true;
      expect(c.sgtGroup.equals(mockGroup)).to.be.true;
      expect(c.globalDailyCap).to.eq(2);
    });
  });

  describe("register_identity", () => {
    it("registers with a mock SGT", async () => {
      const { mint, tokenAccount } = await createSgtMember(conn, authority, authority, mockGroup, viewer.publicKey);
      viewerMint = mint;
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
    const advertiser = Keypair.generate();
    const escrowOf = (id: number) => getAssociatedTokenAddressSync(usdcMint, campaignPda(id), true);

    const create = (id: number, price = 100_000) =>
      program.methods.createCampaign(new BN(id), advertiser.publicKey, root, new BN(price), 3000, 1)
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
      expect(c.advertiser.equals(advertiser.publicKey)).to.be.true;
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

  describe("pay_view, end_campaign, withdraw_unspent", () => {
    const feePayer = Keypair.generate();
    const host = Keypair.generate();
    const advertiser = Keypair.generate();
    const viewer2 = Keypair.generate();
    const viewer3 = Keypair.generate();
    let viewer2Mint: PublicKey;
    let viewer3Mint: PublicKey;
    let hostAta: PublicKey;
    let advertiserAta: PublicKey;
    let leaves: Uint8Array[];
    let root: number[];
    const leafOf = (mint: PublicKey) => sha256(sha256(mint.toBuffer()));
    const escrowOf = (id: number) => getAssociatedTokenAddressSync(usdcMint, campaignPda(id), true);
    const viewerAtaOf = (v: Keypair, mint = usdcMint) => getAssociatedTokenAddressSync(mint, v.publicKey);
    const bal = async (ata: PublicKey) => Number((await conn.getTokenAccountBalance(ata)).value.amount);

    const createActive = async (id: number, price: number, fund: number) => {
      await program.methods.createCampaign(new BN(id), advertiser.publicKey, root, new BN(price), 3000, 1)
        .accountsPartial({ payer: admin.publicKey, config: configPda, campaign: campaignPda(id), usdcMint, escrowAta: escrowOf(id), tokenProgram: TOKEN_PROGRAM_ID }).rpc();
      await mintTo(conn, admin, usdcMint, escrowOf(id), admin, fund);
      await program.methods.activateCampaign()
        .accountsPartial({ config: configPda, campaign: campaignPda(id), escrowAta: escrowOf(id), tokenProgram: TOKEN_PROGRAM_ID }).rpc();
    };

    const payView = (id: number, v: Keypair, mint: PublicKey, opts: { nonce?: Buffer; proof?: Uint8Array[]; attester?: Keypair; feePayer?: Keypair; viewerAta?: PublicKey } = {}) => {
      const nonce = opts.nonce ?? Buffer.from(Keypair.generate().publicKey.toBytes());
      const nonceHash = sha256(nonce);
      const proof = opts.proof ?? merkleProof(leaves, leaves.findIndex((l) => Buffer.from(l).equals(leafOf(mint))));
      const att = opts.attester ?? attester;
      const fp = opts.feePayer ?? feePayer;
      const [impression] = PublicKey.findProgramAddressSync([Buffer.from("impression"), campaignPda(id).toBuffer(), nonceHash], program.programId);
      const viewerAta = opts.viewerAta ?? viewerAtaOf(v);
      return program.methods.payView(Array.from(nonceHash), proof.map((p) => Array.from(p)))
        .accountsPartial({
          viewer: v.publicKey, attester: att.publicKey, feePayer: fp.publicKey, config: configPda,
          identity: identityPda(mint), campaign: campaignPda(id), usdcMint, escrowAta: escrowOf(id),
          viewerAta, hostAta, protocolTreasuryAta: treasuryAta, impression, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .preInstructions([createAssociatedTokenAccountIdempotentInstruction(fp.publicKey, viewerAtaOf(v), v.publicKey, usdcMint)])
        .signers([v, att, fp]).rpc();
    };

    before(async () => {
      for (const k of [feePayer, viewer2, viewer3, advertiser]) {
        const sig = await conn.requestAirdrop(k.publicKey, 5e9);
        await conn.confirmTransaction(sig);
      }
      hostAta = (await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, host.publicKey)).address;
      advertiserAta = (await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, advertiser.publicKey)).address;
      const m = await createSgtMember(conn, authority, authority, mockGroup, viewer2.publicKey);
      viewer2Mint = m.mint;
      await register(viewer2, m.mint, m.tokenAccount);
      const m3 = await createSgtMember(conn, authority, authority, mockGroup, viewer3.publicKey);
      viewer3Mint = m3.mint;
      await register(viewer3, m3.mint, m3.tokenAccount);
      leaves = [leafOf(viewerMint), leafOf(viewer2Mint), leafOf(viewer3Mint), sha256(Buffer.from("someone-else"))];
      root = Array.from(merkleRoot(leaves));
      await createActive(10, 100_000, 1_000_000);
      await createActive(11, 600_000, 1_000_000);
    });

    it("pays 70/20/10 from escrow and records the impression", async () => {
      await payView(10, viewer, viewerMint);
      expect(await bal(viewerAtaOf(viewer))).to.eq(70_000);
      expect(await bal(hostAta)).to.eq(20_000);
      expect(await bal(treasuryAta)).to.eq(10_000);
      expect(await bal(escrowOf(10))).to.eq(900_000);
      const c = await program.account.campaign.fetch(campaignPda(10));
      expect(c.spent.toNumber()).to.eq(100_000);
      const id = await program.account.identity.fetch(identityPda(viewerMint));
      expect(id.viewsToday).to.eq(1);
    });

    it("rejects a reused nonce", async () => {
      const nonce = Buffer.from("fixed-nonce");
      await payView(10, viewer2, viewer2Mint, { nonce });
      await expectFail(payView(10, viewer2, viewer2Mint, { nonce }));
    });

    it("rejects a bad Merkle proof", async () => {
      await expectFail(payView(10, viewer, viewerMint, { proof: [sha256(Buffer.from("x"))] }), "BadMerkleProof");
    });

    it("rejects without the attester signature", async () => {
      await expectFail(payView(10, viewer, viewerMint, { attester: Keypair.generate() }), "NotAttester");
    });

    it("rejects the attester as fee payer", async () => {
      const sig = await conn.requestAirdrop(attester.publicKey, 1e9);
      await conn.confirmTransaction(sig);
      await expectFail(payView(10, viewer, viewerMint, { feePayer: attester }), "FeePayerIsAttester");
    });

    it("rejects a viewer account of another mint", async () => {
      const other = await createMint(conn, admin, admin.publicKey, null, 6);
      const ata = (await getOrCreateAssociatedTokenAccount(conn, admin, other, viewer.publicKey)).address;
      await expectFail(payView(10, viewer, viewerMint, { viewerAta: ata }), "WrongMint");
    });

    it("enforces the global daily cap", async () => {
      await payView(10, viewer, viewerMint); // 2nd view today, cap = 2
      await expectFail(payView(10, viewer, viewerMint), "GlobalCapExceeded");
    });

    it("rejects an underfunded escrow", async () => {
      await payView(11, viewer3, viewer3Mint); // 600k of 1M; 400k left
      await expectFail(payView(11, viewer3, viewer3Mint), "EscrowUnderfunded");
    });

    it("end_campaign: stranger rejected, admin allowed; withdraw only when not Active", async () => {
      const end = (signer: Keypair, id: number) => program.methods.endCampaign()
        .accountsPartial({ signer: signer.publicKey, config: configPda, campaign: campaignPda(id) }).signers([signer]).rpc();
      const withdraw = (id: number) => program.methods.withdrawUnspent()
        .accountsPartial({ advertiser: advertiser.publicKey, config: configPda, campaign: campaignPda(id), usdcMint, escrowAta: escrowOf(id), advertiserAta, tokenProgram: TOKEN_PROGRAM_ID })
        .signers([advertiser]).rpc();
      await expectFail(end(Keypair.generate(), 11), "Unauthorized");
      await expectFail(withdraw(11), "WrongCampaignStatus");
      await end(admin, 11);
      expect((await program.account.campaign.fetch(campaignPda(11))).status).to.deep.eq({ ended: {} });
      await expectFail(payView(11, viewer3, viewer3Mint), "WrongCampaignStatus");
      await withdraw(11);
      expect(await bal(advertiserAta)).to.eq(400_000);
      expect(await bal(escrowOf(11))).to.eq(0);
      await end(advertiser, 10);
    });
  });
});
