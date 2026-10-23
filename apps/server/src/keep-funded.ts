import type { Db } from "./db.js";
import type { ChainLike } from "./chain.js";
import { PublicKey } from "@solana/web3.js";

// Keeps one untargeted campaign funded for the player demo on app.adrop.sh, paid by the demo agent
// wallet (X402_DEMO_SECRET) through the server's own HTTP routes. Opt-in: DEMO_KEEP_FUNDED=1.
// Candidates in POST /impressions are ordered by id, so this never displaces older campaigns.
export type KeepFundedOpts = {
  db: Db; chain: ChainLike; baseUrl: string; usdcMint: string; advertiser: string;
  pricePerView?: number; budget?: number; minViews?: number; intervalMs?: number; creative?: { image_url: string; title: string; cta_url: string };
  fetch?: typeof fetch; log?: (s: string) => void;
};

export function keepFunded(o: KeepFundedOpts) {
  const price = o.pricePerView ?? 500_000, budget = o.budget ?? 5_000_000, minViews = o.minViews ?? 5;
  const f = o.fetch ?? fetch, log = o.log ?? ((s) => console.log(`keep-funded: ${s}`));
  const mint = new PublicKey(o.usdcMint);
  const creative = o.creative ?? { image_url: "https://docs.adrop.sh/brand/title-card.png", title: "Ads that pay the viewer.", cta_url: "https://adrop.sh" };
  const mine = o.db.prepare("SELECT id, price_per_view FROM campaigns WHERE advertiser = ? AND tags = '[]' AND status = 'active' ORDER BY id DESC");
  let current: number | undefined;

  async function usable(): Promise<number | undefined> {
    for (const row of mine.all(o.advertiser) as { id: number; price_per_view: number }[]) {
      const on = await o.chain.fetchCampaign(row.id, mint);
      if (on && on.status === "active" && on.budget - on.spent >= minViews * row.price_per_view) return row.id;
    }
    return undefined;
  }

  async function ensure() {
    try {
      current = await usable();
      if (current) return current;
      const created = await f(`${o.baseUrl}/campaigns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ advertiser: o.advertiser, tags: [], price_per_view: price, budget, freq_cap: 50, min_dwell_ms: 5000, creative }) });
      if (!created.ok) throw new Error(`create ${created.status} ${await created.text()}`);
      const { campaign_id } = await created.json() as { campaign_id: number };
      const funded = await f(`${o.baseUrl}/demo/fund/${campaign_id}`, { method: "POST" });
      if (!funded.ok) throw new Error(`fund ${funded.status} ${await funded.text()}`);
      current = campaign_id;
      log(`campaign ${campaign_id} funded ${budget / 1e6} USDC at ${price / 1e6}/view`);
      return current;
    } catch (e) { log(`failed: ${(e as Error).message}`); return current; }
  }

  return { ensure, id: () => current, start: (ms = o.intervalMs ?? 10 * 60_000) => { ensure(); return setInterval(ensure, ms); } };
}
