// Segment index (SPEC §5). Devnet definition of `dex_swap_30d`: the wallet holds a devnet USDC
// token account, i.e. it has used the demo token. Documented choice; mainnet would query DEX history.
import type { Db } from "./db.js";
import type { Helius } from "./helius.js";
import type { ChainLike } from "./chain.js";
import { sha256 } from "./chain.js";

export const DEMO_TAG = "dex_swap_30d";

export async function buildSegment(tag: string, db: Db, chain: ChainLike, helius: Pick<Helius, "rpc">, usdcMint: string) {
  const ids = await chain.listIdentities();
  const insert = db.prepare("INSERT OR IGNORE INTO segments (tag, wallet) VALUES (?, ?)");
  let matched = 0;
  for (const id of ids) {
    const r = await helius.rpc("getTokenAccountsByOwner", [id.owner, { mint: usdcMint }, { encoding: "jsonParsed" }]);
    if ((r?.value ?? []).length > 0) { insert.run(tag, id.owner); matched++; }
  }
  return { identities: ids.length, matched };
}

/** Leaves = sha256(nullifier) of registered identities whose wallet is in every requested tag. */
export async function segmentLeaves(tags: string[], db: Db, chain: ChainLike): Promise<{ wallet: string; leaf: Uint8Array }[]> {
  const ids = await chain.listIdentities();
  const inTag = db.prepare("SELECT 1 FROM segments WHERE tag = ? AND wallet = ?");
  return ids
    .filter((id) => tags.every((t) => inTag.get(t, id.owner)))
    .map((id) => ({ wallet: id.owner, leaf: sha256(id.nullifier) }));
}
