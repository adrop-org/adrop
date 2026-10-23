// Sample data for the console when the API has nothing to show yet. Every row carries sample: true and is labelled on screen.
import type { Campaign, Activity, Stats } from "./api";

// Published split (owner, 2026-10-23). The chain pays VIEWER_BPS 7000 until the devnet reset; balances on the Paid screen move by the real amounts.
export const SPLIT = { viewer: 5000, host: 2000, protocol: 3000 };
export const mockStats: Stats = { apps: 3, people: 1240, views_week: 8900, split_bps: SPLIT, demo_campaign_id: null, demo_advertiser: null, sample: true };
export const AUDIENCES = [
  { key: "everyone", name: "Everyone verified", floor: 0.25, tags: [] as string[], reach: 1240, meaning: "Every verified person in every app. No profiles, no lists." },
  { key: "targeted", name: "Targeted", floor: 0.5, tags: ["dex_swap_30d"], reach: 310, meaning: "Picked by what their wallet did on-chain, never by who they are." },
  { key: "intent", name: "High-intent", floor: 1, tags: ["dex_swap_30d"], reach: 90, meaning: "Acted on a similar offer in the last 30 days." },
];
const img = "https://docs.adrop.sh/brand/title-card.png";
export const mockCampaigns: Campaign[] = [
  { id: -1, title: "Ads that pay the viewer.", status: "Active", spent: 212, budget: 500, today: 174, reach: 1240, img, link: "https://adrop.sh", audience: "Everyone verified", floor: 0.25, freq: 2, escrow: "5HqM9ZpT5HqM9ZpT5HqM9ZpT5HqM9ZpT5HqM9ZpT9ZpT", sample: true },
  { id: -2, title: "Season pass · 20% off", status: "Draft", spent: 0, budget: 1200, today: 0, reach: 310, img: "", link: "https://adrop.sh", audience: "Targeted", floor: 0.5, freq: 1, escrow: "", sample: true },
  { id: -3, title: "Launch week", status: "Exhausted", spent: 250, budget: 250, today: 0, reach: 1240, img, link: "https://adrop.sh", audience: "Everyone verified", floor: 0.25, freq: 3, escrow: "", sample: true },
];
const series = (v: number[]) => v.map((views, i) => ({ day: Date.now() - (6 - i) * 86_400_000, views }));
export const mockActivity = (id: number, price: number): Activity => ({
  id, sample: true,
  series: series(id === -1 ? [60, 84, 112, 130, 148, 140, 174] : id === -3 ? [210, 180, 160, 120, 90, 60, 0] : [0, 0, 0, 0, 0, 0, 0]),
  payouts: id === -1 ? [
    { viewer: "A4VVqNmjRA2joMgNrv5FwqjKX8kDNVsqSque4FxH6uS8", host_ata: "9xQeR2hd9xQeR2hd9xQeR2hd9xQeR2hd9xQeR2hdR2hd", tx: "", at: Date.now() - 20_000, price_per_view: price },
    { viewer: "7Gk2mN4a7Gk2mN4a7Gk2mN4a7Gk2mN4a7Gk2mN4amN4a", host_ata: "9xQeR2hd9xQeR2hd9xQeR2hd9xQeR2hd9xQeR2hdR2hd", tx: "", at: Date.now() - 120_000, price_per_view: price },
  ] : [],
});
