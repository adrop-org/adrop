import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import BN from "bn.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { createRequire } from "module";
import type { Adrop } from "@adrop/shared/idl/adrop";

const require = createRequire(import.meta.url);
const idl = require("@adrop/shared/idl/adrop.json");

export const sha256 = (b: Uint8Array) => new Uint8Array(createHash("sha256").update(b).digest());
export const nullifierOf = (mint: PublicKey) => sha256(mint.toBytes());

export type IdentityView = { owner: string; proofType: number; viewsToday: number; lastDay: number };
export type IdentityRow = { address: string; owner: string; nullifier: Uint8Array };
export type CampaignView = { id: number; advertiser: string; status: "draft" | "active" | "ended"; pricePerView: number; budget: number; spent: number; escrowAta: string };

export class Chain {
  readonly program: Program<Adrop>;
  readonly programId: PublicKey;
  readonly configPda: PublicKey;
  readonly feePayer: Keypair;
  constructor(readonly connection: Connection, feePayer: Keypair) {
    this.feePayer = feePayer;
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

export type ChainLike = Pick<Chain, "fetchIdentity" | "buildRegisterTx" | "identityPda" | "listIdentities" | "escrowAta" | "fetchCampaign" | "createCampaign" | "fundAndActivate">;
