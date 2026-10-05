"use client";
import { useState } from "react";
import { API_BASE, explorer } from "../lib/config";

type Created = { campaign_id: number; escrow_ata: string; segment_root: string; reachable: number; create_tx: string; fund_url: string };

export function Advertiser() {
  const [form, setForm] = useState({ advertiser: "", title: "Try Adrop", image_url: "https://placehold.co/600x400/png", cta_url: "https://example.com", price_per_view: 0.1, budget: 1, freq_cap: 1 });
  const [created, setCreated] = useState<Created | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const r = await fetch(`${API_BASE}/campaigns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      advertiser: form.advertiser, tags: ["dex_swap_30d"], price_per_view: Math.round(form.price_per_view * 1e6), budget: Math.round(form.budget * 1e6), freq_cap: form.freq_cap,
      creative: { image_url: form.image_url, title: form.title, cta_url: form.cta_url },
    }) });
    const body = await r.json();
    if (!r.ok) return setError(JSON.stringify(body));
    setCreated(body); setStatus(null);
  };
  const refresh = async () => created && setStatus(await (await fetch(`${API_BASE}/campaigns/${created.campaign_id}`)).json());

  return (
    <>
      <section>
        <h2>Create a campaign</h2>
        <p className="muted">Advertisers buy reach, not lists: the server snapshots the audience (<code>dex_swap_30d</code> ∩ registered identities) into a Merkle root. Funding is one x402 request.</p>
        <form onSubmit={create}>
          <label>Advertiser wallet (receives unspent budget)</label><input required value={form.advertiser} onChange={set("advertiser")} placeholder="pubkey" />
          <label>Title</label><input required value={form.title} onChange={set("title")} />
          <label>Image URL</label><input required value={form.image_url} onChange={set("image_url")} />
          <label>Click-through URL</label><input required value={form.cta_url} onChange={set("cta_url")} />
          <div className="row">
            <div><label>Price per view (USDC)</label><input type="number" step="0.01" min="0.01" value={form.price_per_view} onChange={set("price_per_view")} /></div>
            <div><label>Budget (USDC)</label><input type="number" step="0.1" min="0.1" value={form.budget} onChange={set("budget")} /></div>
            <div><label>Views per person per day</label><input type="number" min="1" max="255" value={form.freq_cap} onChange={set("freq_cap")} /></div>
          </div>
          <p><button type="submit">Create (Draft)</button></p>
        </form>
        {error && <pre>{error}</pre>}
      </section>
      {created && (
        <section>
          <h2>Campaign {created.campaign_id} · reach {created.reachable}</h2>
          <p>Escrow <a href={explorer(created.escrow_ata, "address")} target="_blank" rel="noopener"><code>{created.escrow_ata.slice(0, 10)}…</code></a> · <a href={explorer(created.create_tx)} target="_blank" rel="noopener">create tx</a></p>
          <p>Fund it over x402 (any x402 client, including an AI agent):</p>
          <pre>{`curl -i -X POST ${created.fund_url}\n# → 402 PAYMENT-REQUIRED; then with an x402 client:\nX402_DEMO_SECRET=<json keypair> pnpm fund:demo ${API_BASE}`}</pre>
          <pre>{`import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";\nimport { ExactSvmScheme } from "@x402/svm/exact/client";\nconst pay = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", client: new ExactSvmScheme(signer) }] });\nawait pay("${created.fund_url}", { method: "POST" }); // settles ${form.budget} USDC, campaign goes Active`}</pre>
          <p className="row"><button onClick={refresh}>Refresh status</button>{status && <span>status: <b>{status.status}</b> · spent {(status.spent / 1e6).toFixed(2)} / {(status.budget / 1e6).toFixed(2)} USDC</span>}</p>
        </section>
      )}
    </>
  );
}
