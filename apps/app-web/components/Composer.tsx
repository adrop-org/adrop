"use client";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Adrop } from "adrop-sdk";
import type { Stats } from "../lib/api";
import { API_BASE, HOST_ATA, money } from "../lib/config";
import { AUDIENCES } from "../lib/mock";

const DEFAULT_IMG = "https://docs.adrop.sh/brand/title-card.png";

export function Composer({ stats, onCreated }: { stats: Stats | null; onCreated: (id: number) => void }) {
  const wallet = useWallet();
  const [audience, setAudience] = useState(0);
  const [budget, setBudget] = useState(50);
  const [freq, setFreq] = useState(2);
  const [title, setTitle] = useState("Ads that pay the viewer.");
  const [link, setLink] = useState("https://adrop.sh");
  const [img, setImg] = useState(DEFAULT_IMG);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sdk = useMemo(() => wallet.publicKey && wallet.signTransaction && wallet.signMessage
    ? Adrop.init({ apiBase: API_BASE, hostAta: HOST_ATA, wallet: { publicKey: wallet.publicKey, signMessage: wallet.signMessage, signTransaction: wallet.signTransaction } }) : null,
    [wallet.publicKey, wallet.signTransaction, wallet.signMessage]);
  const a = AUDIENCES[audience];
  const reach = (i: number) => i === 0 && stats && !stats.sample ? stats.people : AUDIENCES[i].reach;
  const views = Math.floor(budget / a.floor);
  const canDemo = !!stats?.demo_advertiser;

  const fund = async () => {
    setError(null);
    const input = { tags: a.tags, price_per_view: Math.round(a.floor * 1e6), budget: Math.round(budget * 1e6), freq_cap: freq, creative: { image_url: img.startsWith("http") ? img : DEFAULT_IMG, title, cta_url: link } };
    try {
      if (sdk) {
        setBusy("Creating…"); const c = await sdk.createCampaign(input);
        setBusy("Paying…"); await sdk.fundCampaign(c.campaign_id);
        onCreated(c.campaign_id);
      } else if (canDemo) {
        setBusy("Creating…");
        const r = await fetch(`${API_BASE}/campaigns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, advertiser: stats!.demo_advertiser }) });
        const c = await r.json(); if (!r.ok) throw new Error(JSON.stringify(c));
        setBusy("Paying…");
        const f = await fetch(`${API_BASE}/demo/fund/${c.campaign_id}`, { method: "POST" });
        if (!f.ok) throw new Error(JSON.stringify(await f.json()));
        onCreated(c.campaign_id);
      }
    } catch (e: any) { setError(`${e.code ?? "error"}: ${e.message}`); } finally { setBusy(null); }
  };

  return (
    <section className="sheet" aria-label="New campaign" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div className="sheet-head"><h2>New campaign</h2><span className="small mute">Draft · not funded yet</span></div>
      <div className="field">
        <span className="label">Creative</span>
        <div className="creative">
          <label className="dropzone">
            <img src={img} alt="Campaign creative" onError={() => setImg(DEFAULT_IMG)} />
            <span className="small mute" style={{ padding: "0 4px 4px" }}>Drop an image or click to replace · 16:9</span>
            <input type="file" accept="image/*" aria-label="Creative image" onChange={(e) => { const f = e.target.files?.[0]; if (f) setImg(URL.createObjectURL(f)); }} />
          </label>
          <div className="creative-text">
            <label>Title<input className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></label>
            <label>Link<input className="input" type="url" value={link} onChange={(e) => setLink(e.target.value)} /></label>
          </div>
        </div>
      </div>
      <div className="field">
        <span className="label">Audience · pick one</span>
        <div className="audiences">
          {AUDIENCES.map((x, i) => (
            <button key={x.key} type="button" className="audience" aria-pressed={i === audience} onClick={() => setAudience(i)}>
              <span className="top"><span className="name">{x.name}</span><span className="check" aria-hidden>{i === audience && <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5l3.5 3.5L11 1" /></svg>}</span></span>
              <span className="floor">{money(x.floor, true)} <span>floor per view</span></span>
              <span className="small mute">≈ {reach(i).toLocaleString("en-US")} people</span>
              <span className="small" style={{ lineHeight: 1.4 }}>{x.meaning}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field" style={{ gap: 10 }}>
        <div className="budget-head"><label htmlFor="budget" className="label">Budget</label><span className="budget-value">{money(budget)}</span></div>
        <input id="budget" type="range" min={10} max={5000} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        <div className="budget-foot"><span className="views">≈ <strong>{views.toLocaleString("en-US")}</strong> verified views · {money(a.floor, true)} per view</span><span>$10 – $5,000</span></div>
      </div>
      <div className="freq">
        <div><span className="label">Frequency</span><div>Views per person per day</div></div>
        <div className="stepper"><button type="button" aria-label="Fewer views per person" onClick={() => setFreq(Math.max(1, freq - 1))}>−</button><span>{freq}</span><button type="button" aria-label="More views per person" onClick={() => setFreq(Math.min(5, freq + 1))}>+</button></div>
      </div>
      <div className="fund">
        <button className="btn btn-lg" disabled={!!busy || (!sdk && !canDemo)} onClick={fund}>{busy ?? (sdk ? `Fund with wallet · ${money(budget)}` : canDemo ? `Fund with the demo agent · ${money(budget)}` : "Connect a wallet to fund")}</button>
        <span className="note">Paid over x402 · one USDC transfer into the campaign escrow on Solana devnet</span>
        {error && <span className="error-line">{error}</span>}
      </div>
    </section>
  );
}
