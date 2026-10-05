// Writes test-vectors/merkle.json, read by the Rust unit test in programs/adrop/src/merkle.rs.
import { writeFileSync } from "fs";
import { merkleProof, merkleRoot, sha256 } from "../src/merkle.js";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const cases = [1, 2, 3, 6, 7].map((n) => {
  const leaves = Array.from({ length: n }, (_, i) => sha256(new TextEncoder().encode(`leaf-${i}`)));
  const root = merkleRoot(leaves);
  return {
    leaves: leaves.map(hex),
    root: hex(root),
    proofs: leaves.map((_, i) => merkleProof(leaves, i).map(hex)),
  };
});
writeFileSync(new URL("../test-vectors/merkle.json", import.meta.url), JSON.stringify(cases, null, 1) + "\n");
