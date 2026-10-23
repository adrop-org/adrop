"use client";
import { useEffect, useState } from "react";
import { loadActivity, type Activity, type Campaign, type Split } from "../lib/api";
import { SPLIT } from "../lib/mock";
import { explorer, money, short, usd } from "../lib/config";
import { SplitBar } from "./Shell";

const fmt = (n: number) => n.toLocaleString("en-US");
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const empty = () => Array.from({ length: 7 }, (_, i) => ({ day: Date.now() - (6 - i) * 864e5, views: 0 }));

export function Detail({ campaign: c, split = SPLIT, onNew, analyticsOnly }: { campaign: Campaign; split?: Split; onNew?: () => void; analyticsOnly?: boolean }) {
  const [act, setAct] = useState<Activity | null>(null);
  useEffect(() => { setAct(null); loadActivity(c).then(setAct); }, [c.id, c.sample]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
  const series = act?.series ?? empty();
  const views7 = series.reduce((a, d) => a + d.views, 0);
  const max = Math.max(1, ...series.map((d) => d.views));
  const price = c.floor;
  const shares = { viewer: price * split.viewer / 10_000, host: price * split.host / 10_000, protocol: price * split.protocol / 10_000 };
  const rows = (act?.payouts ?? []).flatMap((p) => [
    { amount: p.price_per_view * split.viewer / 1e10, to: short(p.viewer), role: "viewer", when: ago(p.at), tx: p.tx },
    { amount: p.price_per_view * split.host / 1e10, to: short(p.host_ata), role: "app", when: ago(p.at), tx: p.tx },
    { amount: p.price_per_view * split.protocol / 1e10, to: "Adrop", role: "protocol", when: ago(p.at), tx: p.tx },
  ]).slice(0, 6);

  const analytics = (
    <section className="sheet analytics" aria-label="Analytics">
      <div className="sheet-head"><h2>{c.title}</h2><span className="pill pill-sample">7 days{c.sample || act?.sample ? " · sample" : ""}</span></div>
      <div className="numbers">
        <div><span className="small mute">Views</span><span className="value">{fmt(views7)}</span></div>
        <div><span className="small mute">Spend</span><span className="value">{usd(views7 * price * 1e6)}</span></div>
        <div><span className="small mute">Verified</span><span className="value">100%</span><span className="small mute">0 bots paid</span></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="bars" role="img" aria-label="Views per day for the last 7 days">
          {series.map((d, i) => <div key={i} className={i === 6 ? "today" : ""}><div style={{ height: `${Math.max(2, Math.round((d.views / max) * 100))}%` }} /></div>)}
        </div>
        <div className="bar-labels">
          {series.map((d, i) => <div key={i}><span className="v">{fmt(d.views)}</span><span>{money(d.views * price, true)}</span><span>{DAYS[new Date(d.day).getDay()]}</span></div>)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="small mute">Every {money(price, true)} view · viewers {split.viewer / 100}% · apps {split.host / 100}% · protocol {split.protocol / 100}%</span>
        <SplitBar bps={split} />
        <div className="legend"><span><i style={{ background: "var(--coin)" }} />Viewers {money(shares.viewer, true)}</span><span><i style={{ background: "var(--fg)" }} />Apps {money(shares.host, true)}</span><span><i style={{ background: "var(--tint)" }} />Protocol {money(shares.protocol, true)}</span></div>
      </div>
      <div className="payouts">
        <span className="head">Last payouts</span>
        {rows.length === 0 && <span className="payout mute">No payouts yet.</span>}
        {rows.map((r, i) => (
          <div key={i} className="payout"><span className="amt">{money(r.amount, true)}</span><span className="to">{r.to} <span className="mute">· {r.role}</span></span><span className="when">{r.when}</span>{r.tx ? <a href={explorer(r.tx)} target="_blank" rel="noreferrer">on devnet ↗</a> : <span className="when">sample</span>}</div>
        ))}
      </div>
    </section>
  );
  if (analyticsOnly) return analytics;

  return (
    <section className="sheet detail" aria-label="Campaign detail" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {c.img ? <img className="hero" src={c.img} alt="Campaign creative" /> : <div className="hero" style={{ aspectRatio: "16 / 9", background: "var(--tint-2)", borderRadius: 12 }} />}
      <div className="sheet-head" style={{ alignItems: "center" }}><h2>{c.title}</h2><span className="row" style={{ gap: 6 }}>{c.sample && <span className="pill pill-sample">sample</span>}<span className={`pill pill-${c.status.toLowerCase()}`}>{c.status}</span></span></div>
      <div className="kpis">
        <div className="kpi"><span className="label">Spent</span><span className="value">{money(c.spent, true)} <span>of {money(c.budget)}</span></span><div className={`progress${c.status === "Exhausted" ? " is-exhausted" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div></div>
        <div className="kpi"><span className="label">Views today</span><span className="value">{fmt(c.today)}</span></div>
        <div className="kpi"><span className="label">Reach</span><span className="value">{fmt(c.reach)}</span></div>
      </div>
      <dl className="facts">
        <dt>Audience</dt><dd>{c.audience} · floor {money(c.floor, true)} · {c.freq} view{c.freq === 1 ? "" : "s"} per person per day</dd>
        <dt>Link</dt><dd><a href={c.link} target="_blank" rel="noreferrer">{c.link.replace(/^https?:\/\//, "")} ↗</a></dd>
        <dt>Escrow</dt><dd>{c.escrow ? <>{short(c.escrow)} · <a className="mute" href={explorer(c.escrow, "address")} target="_blank" rel="noreferrer">on devnet ↗</a></> : "—"}</dd>
      </dl>
      <div className="detail-actions">
        <button className="btn" disabled title="Next: top up the same escrow">Top up escrow</button>
        <button className="btn btn-secondary" disabled title="Next: pause a campaign">Pause</button>
        {onNew && <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onNew}>New campaign</button>}
      </div>
    </section>
  );
}
