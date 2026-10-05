// Sorted-pair sha256 Merkle tree (SPEC §5). Leaves are 32-byte hashes supplied by the caller.
// Parent = sha256(min(a,b) ‖ max(a,b)); an odd last node is carried up unchanged.
// Empty tree root = 32 zero bytes. Mirrors programs/adrop/src/merkle.rs.
import { createHash } from "crypto";

export type Hash32 = Uint8Array;

export const sha256 = (...parts: Uint8Array[]): Hash32 => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return new Uint8Array(h.digest());
};

const cmp = (a: Uint8Array, b: Uint8Array) => Buffer.compare(Buffer.from(a), Buffer.from(b));
export const hashPair = (a: Hash32, b: Hash32): Hash32 => (cmp(a, b) <= 0 ? sha256(a, b) : sha256(b, a));

export function merkleRoot(leaves: Hash32[]): Hash32 {
  if (leaves.length === 0) return new Uint8Array(32);
  let level = leaves.slice();
  while (level.length > 1) {
    const next: Hash32[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0];
}

/** Sibling hashes from leaf to root for `leaves[index]`. */
export function merkleProof(leaves: Hash32[], index: number): Hash32[] {
  if (index < 0 || index >= leaves.length) throw new RangeError("index out of range");
  const proof: Hash32[] = [];
  let level = leaves.slice();
  let i = index;
  while (level.length > 1) {
    const sib = i ^ 1;
    if (sib < level.length) proof.push(level[sib]);
    const next: Hash32[] = [];
    for (let j = 0; j < level.length; j += 2) {
      next.push(j + 1 < level.length ? hashPair(level[j], level[j + 1]) : level[j]);
    }
    level = next;
    i = Math.floor(i / 2);
  }
  return proof;
}

export function merkleVerify(root: Hash32, leaf: Hash32, proof: Hash32[]): boolean {
  let node = leaf;
  for (const sib of proof) node = hashPair(node, sib);
  return cmp(node, root) === 0;
}
