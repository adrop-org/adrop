// Ed25519 over node:crypto, no extra dependency. Solana keys: 32-byte pubkey, 64-byte secret (seed ‖ pub).
import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "crypto";

const SPKI = Buffer.from("302a300506032b6570032100", "hex");
const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");

export const verify = (msg: Uint8Array, sig: Uint8Array, pubkey: Uint8Array) =>
  sig.length === 64 && nodeVerify(null, msg, createPublicKey({ key: Buffer.concat([SPKI, pubkey]), format: "der", type: "spki" }), sig);

export const sign = (msg: Uint8Array, secretKey: Uint8Array) =>
  new Uint8Array(nodeSign(null, msg, createPrivateKey({ key: Buffer.concat([PKCS8, secretKey.slice(0, 32)]), format: "der", type: "pkcs8" })));
