import { describe, expect, it } from "vitest";
import { merkleProof, merkleRoot, merkleVerify, sha256 } from "./merkle.js";

const leaf = (i: number) => sha256(new TextEncoder().encode(`leaf-${i}`));

describe("merkle", () => {
  it("empty root is zero", () => expect(merkleRoot([])).toEqual(new Uint8Array(32)));
  it("single leaf is its own root", () => expect(merkleRoot([leaf(0)])).toEqual(leaf(0)));
  it("is order-independent within a pair", () => {
    expect(merkleRoot([leaf(0), leaf(1)])).toEqual(merkleRoot([leaf(1), leaf(0)]));
  });
  for (const n of [1, 2, 3, 5, 8, 13]) {
    it(`proves every leaf of ${n}`, () => {
      const leaves = Array.from({ length: n }, (_, i) => leaf(i));
      const root = merkleRoot(leaves);
      leaves.forEach((l, i) => {
        const p = merkleProof(leaves, i);
        expect(merkleVerify(root, l, p)).toBe(true);
        expect(merkleVerify(root, leaf(99), p)).toBe(false);
        if (p.length) expect(merkleVerify(root, l, p.slice(1))).toBe(false);
      });
    });
  }
});
