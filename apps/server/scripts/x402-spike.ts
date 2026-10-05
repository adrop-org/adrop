// T21 x402 spike: a throwaway paid route (paymentMiddleware, $0.01 devnet USDC, payTo = fee payer)
// and an @x402/fetch client that pays through https://x402.org/facilitator. Prints the settle tx.
// Env: FEE_PAYER_SECRET, X402_DEMO_SECRET (JSON keypairs), RPC_URL optional.
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactSvmScheme as ExactSvmServer } from "@x402/svm/exact/server";
import { ExactSvmScheme as ExactSvmClient } from "@x402/svm/exact/client";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { Keypair } from "@solana/web3.js";
import { X402_FACILITATOR, X402_NETWORK_DEVNET } from "@adrop/shared";

const rpcUrl = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const feePayer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.FEE_PAYER_SECRET!)));
const payerBytes = Uint8Array.from(JSON.parse(process.env.X402_DEMO_SECRET!));

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: X402_FACILITATOR }))
  .register(X402_NETWORK_DEVNET, new ExactSvmServer({ rpcUrl }));
const app = express();
app.use(paymentMiddleware({
  "GET /spike": { accepts: [{ scheme: "exact", price: "$0.01", network: X402_NETWORK_DEVNET, payTo: feePayer.publicKey.toBase58() }], description: "x402 spike" },
}, resourceServer));
app.get("/spike", (_req, res) => res.json({ paid: true, at: Date.now() }));
const server = app.listen(0);
const port = (server.address() as any).port;

const unpaid = await fetch(`http://localhost:${port}/spike`);
console.log("unpaid status", unpaid.status, "PAYMENT-REQUIRED header present:", unpaid.headers.has("payment-required"));

const signer = await createKeyPairSignerFromBytes(payerBytes);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: X402_NETWORK_DEVNET, client: new ExactSvmClient(signer, { rpcUrl }) }] });
const t0 = Date.now();
const res = await paidFetch(`http://localhost:${port}/spike`, { method: "GET" });
const body = await res.json();
const pr = res.headers.get("payment-response");
console.log("paid status", res.status, body, `${Date.now() - t0}ms`);
console.log("PAYMENT-RESPONSE", pr ? JSON.stringify(decodePaymentResponseHeader(pr)) : null);
server.close();
