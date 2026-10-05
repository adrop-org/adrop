import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import BN from "bn.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { createRequire } from "module";
import type { Adrop } from "@adrop/shared/idl/adrop";

const require = createRequire(import.meta.url);
const idl = require("@adrop/shared/idl/adrop.json");

export const sha256 = (b: Uint8Array) => new Uint8Array(createHash("sha256").update(b).digest());
export const nullifierOf = (mint: PublicKey) => sha256(mint.toBytes());

export type IdentityView = { owner: string; proofType: number; viewsToday: number; lastDay: number };

export class Chain {
  readonly program: Program<Adrop>;
  readonly programId: PublicKey;
  readonly configPda: PublicKey;
  constructor(readonly connection: Connection, feePayer: Keypair) {
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

export type ChainLike = Pick<Chain, "fetchIdentity" | "buildRegisterTx" | "identityPda">;
