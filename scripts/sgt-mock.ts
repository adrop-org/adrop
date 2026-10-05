// Devnet/localnet SGT mock (SPEC §8): a Token-2022 group mint and member mints whose
// MetadataPointer and TokenGroupMember both point at the group, mirroring the real SGT.
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TOKEN_GROUP_MEMBER_SIZE, TOKEN_GROUP_SIZE,
  TYPE_SIZE, createAssociatedTokenAccountIdempotentInstruction, createInitializeGroupInstruction,
  createInitializeGroupMemberPointerInstruction, createInitializeGroupPointerInstruction,
  createInitializeMemberInstruction, createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction, createMintToInstruction, getAssociatedTokenAddressSync, getMintLen,
} from "@solana/spl-token";
import * as fs from "fs";

export async function createSgtGroup(conn: Connection, payer: Keypair, authority: Keypair): Promise<PublicKey> {
  const mint = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.GroupPointer]);
  const total = mintLen + TYPE_SIZE + LENGTH_SIZE + TOKEN_GROUP_SIZE;
  const lamports = await conn.getMinimumBalanceForRentExemption(total);
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeGroupPointerInstruction(mint.publicKey, authority.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint.publicKey, 0, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    createInitializeGroupInstruction({ programId: TOKEN_2022_PROGRAM_ID, group: mint.publicKey, mint: mint.publicKey, mintAuthority: authority.publicKey, updateAuthority: authority.publicKey, maxSize: BigInt(1_000_000) }),
  );
  await sendAndConfirmTransaction(conn, tx, [payer, mint, authority]);
  return mint.publicKey;
}

/** Creates one member mint of `group`; mints 1 to `holder` unless `amount` is 0. */
export async function createSgtMember(
  conn: Connection, payer: Keypair, authority: Keypair, group: PublicKey, holder: PublicKey, amount = 1,
): Promise<{ mint: PublicKey; tokenAccount: PublicKey }> {
  const mint = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.GroupMemberPointer, ExtensionType.MetadataPointer]);
  const total = mintLen + TYPE_SIZE + LENGTH_SIZE + TOKEN_GROUP_MEMBER_SIZE;
  const lamports = await conn.getMinimumBalanceForRentExemption(total);
  const tokenAccount = getAssociatedTokenAddressSync(mint.publicKey, holder, false, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeGroupMemberPointerInstruction(mint.publicKey, authority.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createInitializeMetadataPointerInstruction(mint.publicKey, authority.publicKey, group, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint.publicKey, 0, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    createInitializeMemberInstruction({ programId: TOKEN_2022_PROGRAM_ID, member: mint.publicKey, memberMint: mint.publicKey, memberMintAuthority: authority.publicKey, group, groupUpdateAuthority: authority.publicKey }),
    createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, tokenAccount, holder, mint.publicKey, TOKEN_2022_PROGRAM_ID),
  );
  if (amount > 0) tx.add(createMintToInstruction(mint.publicKey, tokenAccount, authority.publicKey, amount, [], TOKEN_2022_PROGRAM_ID));
  await sendAndConfirmTransaction(conn, tx, [payer, mint, authority]);
  return { mint: mint.publicKey, tokenAccount };
}

// CLI: pnpm sgt:mock <holder-pubkey> [group-pubkey]. Payer/authority = ~/.config/solana/id.json or $SGT_AUTHORITY_KEYPAIR.
if (require.main === module) {
  (async () => {
    const [holderArg, groupArg] = process.argv.slice(2);
    if (!holderArg) throw new Error("usage: sgt-mock <holder-pubkey> [group-pubkey]");
    const conn = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
    const kpPath = process.env.SGT_AUTHORITY_KEYPAIR ?? `${process.env.HOME}/.config/solana/id.json`;
    const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, "utf8"))));
    const group = groupArg ? new PublicKey(groupArg) : await createSgtGroup(conn, authority, authority);
    const { mint, tokenAccount } = await createSgtMember(conn, authority, authority, group, new PublicKey(holderArg));
    console.log(JSON.stringify({ group: group.toBase58(), mint: mint.toBase58(), tokenAccount: tokenAccount.toBase58() }, null, 2));
  })().catch((e) => { console.error(e); process.exit(1); });
}
