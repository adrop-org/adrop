import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import BN from "bn.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createHash } from "crypto";
import { createRequire } from "module";
import type { Adrop } from "@adrop/shared/idl/adrop";

const require = createRequire(import.meta.url);
const idl = require("@adrop/shared/idl/adrop.json");

export const sha256 = (b: Uint8Array) => new Uint8Array(createHash("sha256").update(b).digest());
export const nullifierOf = (mint: PublicKey) => sha256(mint.toBytes());

export type IdentityView = { owner: string; proofType: number; viewsToday: number; lastDay: number };
export type IdentityRow = { address: string; owner: string; nullifier: Uint8Array; viewsToday?: number; lastDay?: number };
export type PayViewArgs = { viewer: PublicKey; identity: PublicKey; campaignId: number; nonceHash: Uint8Array; proof: Uint8Array[]; hostAta: PublicKey; usdcMint: PublicKey; treasuryAta: PublicKey };
export type BuiltTx = { tx_base64: string; message_hash: string; blockhash: string };
export type CampaignView = { id: number; advertiser: string; status: "draft" | "active" | "ended"; pricePerView: number; budget: number; spent: number; escrowAta: string };

export class Chain {
  readonly program: Program<Adrop>;
  readonly programId: PublicKey;
  readonly configPda: PublicKey;
  readonly feePayer: Keypair;
  readonly attester?: Keypair;
  constructor(readonly connection: Connection, feePayer: Keypair, attester?: Keypair) {
    this.feePayer = feePayer;
    this.attester = attester;
    const provider = new AnchorProvider(connection, new Wallet(feePayer), { commitment: "confirmed" });
    this.program = new Program<Adrop>(idl, provider);
    this.programId = this.program.programId;
    this.configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], this.programId)[0];
  }

  identityPda(mint: PublicKey) {
    return PublicKey.findProgramAddressSync([Buffer.from("identity"), nullifierOf(mint)], this.programId)[0];
  }
  campaignPda(id: number | BN) {
    return PublicKey.findProgramAddressSync([Buffer.from("campaign"), new BN(id).toArrayLike(Buffer, "le", 8)], this.programId)[0];
  }

  async getConfig() {
    return this.program.account.config.fetch(this.configPda);
  }

  async fetchIdentity(mint: PublicKey): Promise<IdentityView | null> {
    const acc = await this.program.account.identity.fetchNullable(this.identityPda(mint));
    return acc && { owner: acc.owner.toBase58(), proofType: acc.proofType, viewsToday: acc.viewsToday, lastDay: acc.lastDay };
  }

  async listIdentities(): Promise<IdentityRow[]> {
    const all = await this.program.account.identity.all();
    return all.map((a) => ({ address: a.publicKey.toBase58(), owner: a.account.owner.toBase58(), nullifier: Uint8Array.from(a.account.proofNullifier) }));
  }

  async findIdentityByOwner(owner: PublicKey): Promise<IdentityRow | null> {
    const [a] = await this.program.account.identity.all([{ memcmp: { offset: 8, bytes: owner.toBase58() } }]);
    return a ? { address: a.publicKey.toBase58(), owner: a.account.owner.toBase58(), nullifier: Uint8Array.from(a.account.proofNullifier), viewsToday: a.account.viewsToday, lastDay: a.account.lastDay } : null;
  }

  impressionPda(campaign: PublicKey, nonceHash: Uint8Array) {
    return PublicKey.findProgramAddressSync([Buffer.from("impression"), campaign.toBytes(), nonceHash], this.programId)[0];
  }

  /** pay_view tx: viewer_ata create-idempotent (paid by fee payer) + pay_view; signed by attester and fee payer, viewer signs last. */
  async buildPayViewTx(a: PayViewArgs): Promise<BuiltTx> {
    if (!this.attester) throw new Error("attester key not loaded");
    const campaign = this.campaignPda(a.campaignId);
    const viewerAta = getAssociatedTokenAddressSync(a.usdcMint, a.viewer);
    const tx = await this.program.methods.payView(Array.from(a.nonceHash), a.proof.map((p) => Array.from(p)))
      .accountsPartial({
        viewer: a.viewer, attester: this.attester.publicKey, feePayer: this.feePayer.publicKey, config: this.configPda, identity: a.identity, campaign,
        usdcMint: a.usdcMint, escrowAta: this.escrowAta(a.campaignId, a.usdcMint), viewerAta, hostAta: a.hostAta, protocolTreasuryAta: a.treasuryAta,
        impression: this.impressionPda(campaign, a.nonceHash), tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .preInstructions([createAssociatedTokenAccountIdempotentInstruction(this.feePayer.publicKey, viewerAta, a.viewer, a.usdcMint)])
      .transaction();
    tx.feePayer = this.feePayer.publicKey;
    const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.partialSign(this.attester, this.feePayer);
    const message_hash = Buffer.from(sha256(tx.serializeMessage())).toString("hex");
    return { tx_base64: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), message_hash, blockhash };
  }

  /** Sends a fully signed tx; returns the signature. Rejects a message that differs from `expectedMessageHash`. */
  async sendSignedTx(signed_tx_base64: string, expectedMessageHash?: string): Promise<string> {
    const tx = Transaction.from(Buffer.from(signed_tx_base64, "base64"));
    if (expectedMessageHash && Buffer.from(sha256(tx.serializeMessage())).toString("hex") !== expectedMessageHash) throw new Error("transaction does not match the claim");
    if (!tx.verifySignatures(true)) throw new Error("missing or invalid signatures");
    const sig = await this.connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await this.connection.confirmTransaction(sig, "confirmed");
    return sig;
  }

  escrowAta(id: number, usdcMint: PublicKey) {
    return getAssociatedTokenAddressSync(usdcMint, this.campaignPda(id), true);
  }

  async fetchCampaign(id: number, usdcMint: PublicKey): Promise<CampaignView | null> {
    const c = await this.program.account.campaign.fetchNullable(this.campaignPda(id));
    if (!c) return null;
    const status = ("active" in c.status ? "active" : "ended" in c.status ? "ended" : "draft") as CampaignView["status"];
    return { id: c.id.toNumber(), advertiser: c.advertiser.toBase58(), status, pricePerView: c.pricePerView.toNumber(), budget: c.budget.toNumber(), spent: c.spent.toNumber(), escrowAta: this.escrowAta(id, usdcMint).toBase58() };
  }

  /** create_campaign signed and paid by the fee payer (SPEC §4: advertiser from the body). */
  async createCampaign(id: number, advertiser: PublicKey, segmentRoot: Uint8Array, pricePerView: number, minDwellMs: number, freqCap: number, usdcMint: PublicKey): Promise<string> {
    return this.program.methods.createCampaign(new BN(id), advertiser, Array.from(segmentRoot), new BN(pricePerView), minDwellMs, freqCap)
      .accountsPartial({ payer: this.feePayer.publicKey, config: this.configPda, campaign: this.campaignPda(id), usdcMint, escrowAta: this.escrowAta(id, usdcMint), tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
  }

  /** One tx: USDC fee-payer ATA -> escrow, then activate_campaign. */
  async fundAndActivate(id: number, amount: number, usdcMint: PublicKey): Promise<string> {
    const from = getAssociatedTokenAddressSync(usdcMint, this.feePayer.publicKey);
    const forward = createTransferCheckedInstruction(from, usdcMint, this.escrowAta(id, usdcMint), this.feePayer.publicKey, amount, 6);
    return this.program.methods.activateCampaign()
      .accountsPartial({ config: this.configPda, campaign: this.campaignPda(id), escrowAta: this.escrowAta(id, usdcMint), tokenProgram: TOKEN_PROGRAM_ID })
      .preInstructions([forward])
      .rpc();
  }

  /** Unsigned register_identity tx, fee payer = wallet. */
  async buildRegisterTx(wallet: PublicKey, mint: PublicKey, tokenAccount: PublicKey): Promise<string> {
    const tx = await this.program.methods.registerIdentity(Array.from(nullifierOf(mint)))
      .accountsPartial({ owner: wallet, config: this.configPda, sgtTokenAccount: tokenAccount, sgtMint: mint, tokenProgram: TOKEN_2022_PROGRAM_ID, identity: this.identityPda(mint) })
      .transaction();
    tx.feePayer = wallet;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash("confirmed")).blockhash;
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  }
}

export type ChainLike = Pick<Chain, "fetchIdentity" | "buildRegisterTx" | "identityPda" | "listIdentities" | "escrowAta" | "fetchCampaign" | "createCampaign" | "fundAndActivate" | "findIdentityByOwner" | "buildPayViewTx" | "sendSignedTx">;
