import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  ExtensionType, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TOKEN_GROUP_MEMBER_SIZE, TYPE_SIZE,
  createAssociatedTokenAccountIdempotentInstruction, createInitializeGroupMemberPointerInstruction,
  createInitializeMemberInstruction, createInitializeMetadataPointerInstruction, createInitializeMintInstruction,
  createMintToInstruction, getAssociatedTokenAddressSync, getMintLen,
} from "@solana/spl-token";

// Demo only: one mock Genesis Token (member of the mock group) for `holder`. Same as createSgtMember in
// scripts/sgt-mock.ts, copied because the server image does not ship the root scripts. Removed with the demo app.
export async function mintMockSgt(conn: Connection, authority: Keypair, group: PublicKey, holder: PublicKey): Promise<PublicKey> {
  const mint = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.GroupMemberPointer, ExtensionType.MetadataPointer]);
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen + TYPE_SIZE + LENGTH_SIZE + TOKEN_GROUP_MEMBER_SIZE);
  const ata = getAssociatedTokenAddressSync(mint.publicKey, holder, false, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: authority.publicKey, newAccountPubkey: mint.publicKey, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeGroupMemberPointerInstruction(mint.publicKey, authority.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createInitializeMetadataPointerInstruction(mint.publicKey, authority.publicKey, group, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint.publicKey, 0, authority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    createInitializeMemberInstruction({ programId: TOKEN_2022_PROGRAM_ID, member: mint.publicKey, memberMint: mint.publicKey, memberMintAuthority: authority.publicKey, group, groupUpdateAuthority: authority.publicKey }),
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, holder, mint.publicKey, TOKEN_2022_PROGRAM_ID),
    createMintToInstruction(mint.publicKey, ata, authority.publicKey, 1, [], TOKEN_2022_PROGRAM_ID),
  );
  await sendAndConfirmTransaction(conn, tx, [authority, mint]);
  return mint.publicKey;
}
