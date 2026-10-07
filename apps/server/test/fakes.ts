import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { FacilitatorClient } from "@x402/core/server";
import type { ChainLike, IdentityRow } from "../src/chain.js";
import { sha256 } from "../src/chain.js";
import { openDb } from "../src/db.js";
import { X402 } from "../src/x402.js";

export const NETWORK = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const FEE_PAYER = Keypair.generate().publicKey;
const PROGRAM = Keypair.generate().publicKey;

export const identity = (owner: string, mint = Keypair.generate().publicKey): IdentityRow =>
  ({ address: Keypair.generate().publicKey.toBase58(), owner, nullifier: sha256(mint.toBytes()) });

export const FEE_PAYER_KP = Keypair.generate();
export const ATTESTER_KP = Keypair.generate();

export function fakeChain(identities: IdentityRow[] = []) {
  const calls: Record<string, unknown[][]> = { createCampaign: [], fundAndActivate: [], buildPayViewTx: [], sendSignedTx: [] };
  const campaigns = new Map<number, any>();
  const chain: ChainLike = {
    identityPda: (mint) => PublicKey.findProgramAddressSync([Buffer.from("identity"), mint.toBytes()], PROGRAM)[0],
    fetchIdentity: async () => null,
    buildRegisterTx: async () => "",
    listIdentities: async () => identities,
    escrowAta: (id, mint) => getAssociatedTokenAddressSync(mint, PublicKey.findProgramAddressSync([Buffer.from("campaign"), Buffer.from(String(id))], PROGRAM)[0], true),
    fetchCampaign: async (id) => campaigns.get(id) ?? null,
    createCampaign: async (...a) => { calls.createCampaign.push(a); campaigns.set(a[0], { id: a[0], status: "draft", spent: 0 }); return "create-tx"; },
    fundAndActivate: async (...a) => { calls.fundAndActivate.push(a); campaigns.get(a[0]).status = "active"; return "activate-tx"; },
    findIdentityByOwner: async (owner) => identities.find((i) => i.owner === owner.toBase58()) ?? null,
    buildPayViewTx: async (a) => {
      calls.buildPayViewTx.push([a]);
      const tx = new Transaction({ feePayer: FEE_PAYER_KP.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() })
        .add(SystemProgram.transfer({ fromPubkey: a.viewer, toPubkey: a.hostAta, lamports: 1 }));
      tx.partialSign(FEE_PAYER_KP);
      const message_hash = Buffer.from(sha256(tx.serializeMessage())).toString("hex");
      return { tx_base64: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"), message_hash, blockhash: tx.recentBlockhash! };
    },
    sendSignedTx: async (b64, expected) => {
      const tx = Transaction.from(Buffer.from(b64, "base64"));
      if (expected && Buffer.from(sha256(tx.serializeMessage())).toString("hex") !== expected) throw new Error("transaction does not match the claim");
      if (!tx.verifySignatures(true)) throw new Error("missing or invalid signatures");
      calls.sendSignedTx.push([b64]);
      return "pay-tx";
    },
  };
  return { chain, calls, campaigns };
}

const FACILITATOR_FEE_PAYER = Keypair.generate().publicKey.toBase58();
export const fakeFacilitator: FacilitatorClient = {
  getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK, extra: { feePayer: FACILITATOR_FEE_PAYER } }], extensions: [], signers: {} }),
  verify: async () => ({ isValid: true, payer: "x" } as any),
  settle: async () => ({ success: true, transaction: "settle-tx", network: NETWORK, payer: "x" }),
};

export const HOST_ATA = Keypair.generate().publicKey.toBase58();
export const testDeps = (identities: IdentityRow[] = []) => {
  const { chain, calls, campaigns } = fakeChain(identities);
  const db = openDb(":memory:");
  const x402 = new X402({ facilitator: fakeFacilitator, network: NETWORK, usdcMint: USDC, payTo: FEE_PAYER.toBase58() });
  return { chain, calls, campaigns, db, x402, usdcMint: USDC, baseUrl: "http://test", treasuryAta: Keypair.generate().publicKey.toBase58(), globalDailyCap: 2, hostAtas: [HOST_ATA] };
};
