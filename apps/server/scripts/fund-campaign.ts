// Day-3 checkpoint client: POST /campaigns, then pay /campaigns/:id/fund over x402 as the agent
// wallet (X402_DEMO_SECRET). Usage: tsx fund-campaign.ts [serverUrl] [advertiserPubkey]
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { X402_NETWORK_DEVNET } from "@adrop/shared";

const [base = "http://localhost:3000", advertiser] = process.argv.slice(2);
const rpcUrl = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(process.env.X402_DEMO_SECRET!)));
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: X402_NETWORK_DEVNET, client: new ExactSvmScheme(signer, { rpcUrl }) }] });

const created = await (await fetch(`${base}/campaigns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
  advertiser: advertiser ?? signer.address, tags: ["dex_swap_30d"], price_per_view: 100_000, budget: 1_000_000, freq_cap: Number(process.env.FREQ_CAP ?? 1),
  creative: { image_url: "https://placehold.co/600x400/png", title: "Try Adrop", cta_url: "https://example.com" },
}) })).json();
console.log("created", created);
const unpaid = await fetch(created.fund_url, { method: "POST" });
console.log("unpaid", unpaid.status, (await unpaid.json()).error ?? "");
const t0 = Date.now();
const paid = await paidFetch(created.fund_url, { method: "POST" });
console.log("paid", paid.status, await paid.json(), `${Date.now() - t0}ms`);
console.log("campaign", await (await fetch(`${base}/campaigns/${created.campaign_id}`)).json());
