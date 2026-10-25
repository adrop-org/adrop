"use client";
import { useEffect, useState } from "react";
import { loadConsole, type Campaign, type Stats } from "../lib/api";
import { money } from "../lib/config";
import { Composer } from "./Composer";
import { Detail } from "./Detail";
import { Footer, Header } from "./Shell";

const fmt = (n: number) => n.toLocaleString("en-US");
const LIST_ROWS = 5;

export function Console() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<"composer" | "detail">("composer");
  const reload = () => loadConsole().then((r) => { setStats(r.stats); setCampaigns(r.campaigns); setSelected((s) => s ?? r.campaigns[0]?.id ?? null); });
  useEffect(() => { reload(); }, []);
  const sel = campaigns.find((c) => c.id === selected) ?? campaigns[0];
  const active = campaigns.filter((c) => c.status === "Active").length;
  const shown = showAll ? campaigns : campaigns.slice(0, LIST_ROWS);

  return (
    <div className="shell">
      <Header />
      <main className="main">
        <h1 className="headline">Push one campaign into every <em>app</em> in the network.</h1>
        <div className="strip">
          <div className="tiles">
            <div className="tile"><span className="label">Apps in the network</span><span className="value">{stats ? fmt(stats.apps) : "…"}</span></div>
            <div className="tile"><span className="label">Verified people</span><span className="value">{stats ? fmt(stats.people) : "…"}</span></div>
            <div className="tile"><span className="label">Views paid this week</span><span className="value" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>{stats ? fmt(stats.views_week) : "…"}<i aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--coin)" }} /></span></div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setView("composer")}>New campaign</button>
            <a className="btn btn-secondary btn-link" href="/play">Watch an ad as a player</a>
          </div>
        </div>
        <div className="columns">
          <div className="col-main">
            {view === "composer" || !sel
              ? <Composer stats={stats} onCreated={(id) => { reload().then(() => { setSelected(id); setView("detail"); }); }} />
              : <Detail campaign={sel} onNew={() => setView("composer")} />}
          </div>
          <aside className="col-side" aria-label="Campaigns and analytics">
            <div className="list">
              <div className="list-head"><h2>Campaigns</h2><span className="small mute">{campaigns.length} · {active} active</span></div>
              {shown.map((c) => (
                <button key={c.id} className="campaign" aria-pressed={c.id === sel?.id} onClick={() => { setSelected(c.id); setView("detail"); }}>
                  {c.img ? <img className="thumb" src={c.img} alt="" /> : <span className="thumb" aria-hidden />}
                  <span className="body">
                    <span className="top"><span className="title">{c.title}</span><span className="row" style={{ gap: 6, flex: "none" }}>{c.sample && <span className="pill pill-sample">sample</span>}<span className={`pill pill-${c.status.toLowerCase()}`}>{c.status}</span></span></span>
                    <span className={`progress${c.status === "Exhausted" ? " is-exhausted" : ""}`} role="progressbar" aria-valuenow={Math.round((c.spent / c.budget) * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, (c.spent / c.budget) * 100)}%` }} /></span>
                    <span className="meta"><span><strong>{money(c.spent, true)}</strong> of {money(c.budget)}</span><span>{fmt(c.today)} views today</span><span>reach {fmt(c.reach)}</span></span>
                  </span>
                </button>
              ))}
              {campaigns.length > LIST_ROWS && (
                <button className="btn btn-ghost list-more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `Show all ${campaigns.length}`}
                </button>
              )}
            </div>
            {sel && <Detail campaign={sel} analyticsOnly />}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
