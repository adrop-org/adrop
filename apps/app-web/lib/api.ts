import { API_BASE, CONSOLE_CAMPAIGNS } from "./config";
import { AUDIENCES, mockActivity, mockCampaigns, mockStats } from "./mock";

export type Split = { viewer: number; host: number; protocol: number };
export type Stats = { apps: number; people: number; views_week: number; split_bps: Split; demo_campaign_id: number | null; demo_advertiser: string | null; sample?: boolean };
export type Campaign = { id: number; title: string; status: "Active" | "Draft" | "Exhausted"; spent: number; budget: number; today: number; reach: number; img: string; link: string; audience: string; floor: number; freq: number; escrow: string; sample?: boolean };
export type Payout = { viewer: string; host_ata: string; tx: string; at: number; price_per_view: number };
export type Activity = { id: number; series: { day: number; views: number }[]; payouts: Payout[]; sample?: boolean };

export async function get<T>(path: string, ms = 3000): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

const audienceOf = (tags: string[], price: number) => tags.length === 0 ? AUDIENCES[0].name : price >= 1_000_000 ? AUDIENCES[2].name : AUDIENCES[1].name;

export function toCampaign(c: any): Campaign {
  const spent = c.spent / 1e6, budget = c.budget / 1e6;
  const status = c.status === "draft" ? "Draft" : c.status === "ended" || spent >= budget ? "Exhausted" : "Active";
  return { id: c.id, title: c.creative?.title ?? `Campaign ${c.id}`, status, spent, budget, today: c.views_today ?? 0, reach: c.reachable ?? 0, img: c.creative?.image_url ?? "", link: c.creative?.cta_url ?? "", audience: audienceOf(c.tags ?? [], c.price_per_view), floor: c.price_per_view / 1e6, freq: c.freq_cap ?? 1, escrow: c.escrow_ata ?? "" };
}

const curated = (c: Campaign) => CONSOLE_CAMPAIGNS.includes(c.id) || c.id > Math.max(...CONSOLE_CAMPAIGNS);

/** Curated live rows; sample rows only when there are none. Network tiles stay sample until the network is real (owner, 2026-10-25). */
export async function loadConsole(): Promise<{ stats: Stats; campaigns: Campaign[]; online: boolean }> {
  try {
    const [stats, list] = await Promise.all([get<Stats>("/stats"), get<any[]>("/campaigns")]);
    const campaigns = list.map(toCampaign).filter(curated);
    return { stats: { ...stats, apps: mockStats.apps, people: mockStats.people, views_week: mockStats.views_week, sample: true }, campaigns: campaigns.length ? campaigns : mockCampaigns, online: true };
  } catch { return { stats: mockStats, campaigns: mockCampaigns, online: false }; }
}

export async function loadActivity(c: Campaign): Promise<Activity> {
  if (c.sample) return mockActivity(c.id, c.floor * 1e6);
  try { return await get<Activity>(`/campaigns/${c.id}/activity`); } catch { return { id: c.id, series: mockActivity(0, 0).series, payouts: [] }; }
}
