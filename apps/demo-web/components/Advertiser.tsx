"use client";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Adrop } from "adrop-sdk";
import { API_BASE, HOST_ATA, explorer } from "../lib/config";

type Created = { campaign_id: number; escrow_ata: string; segment_root: string; reachable: number; create_tx: string; fund_url: string };

export function Advertiser() {
  const [form, setForm] = useState({ advertiser: "", title: "Try Adrop", image_url: "https://docs.adrop.sh/brand/title-card.png", cta_url: "https://example.com", price_per_view: 0.1, budget: 1, freq_cap: 1, audience: "dex_swap_30d", test_wallets: "" });
  const [created, setCreated] = useState<Created | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const wallet = useWallet();
  // Same SDK a host app ships; here used from the advertiser side: createCampaign + fundCampaign (x402 paid by the connected wallet).
  const sdk = useMemo(() => wallet.publicKey && wallet.signTransaction && wallet.signMessage
    ? Adrop.init({ apiBase: API_BASE, hostAta: HOST_ATA, wallet: { publicKey: wallet.publicKey, signMessage: wallet.signMessage, signTransaction: wallet.signTransaction } })
    : null, [wallet.publicKey, wallet.signTransaction, wallet.signMessage]);
  const [busy, setBusy] = useState(false);
  const [funded, setFunded] = useState<{ settle_tx: string; activate_tx: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const input = {
      advertiser: form.advertiser || wallet.publicKey?.toBase58(), tags: form.audience ? [form.audience] : [], price_per_view: Math.round(form.price_per_view * 1e6), budget: Math.round(form.budget * 1e6), freq_cap: form.freq_cap,
      creative: { image_url: form.image_url, title: form.title, cta_url: form.cta_url },
      test_wallets: form.test_wallets.split(/[\s,]+/).filter(Boolean).slice(0, 5),
    };
    try {
      if (sdk) { setCreated(await sdk.createCampaign(input)); setStatus(null); setFunded(null); return; }
      const r = await fetch(`${API_BASE}/campaigns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const body = await r.json();
      if (!r.ok) return setError(JSON.stringify(body));
      setCreated(body); setStatus(null);
    } catch (e: any) { setError(`${e.code ?? "error"}: ${e.message}`); }
  };
  const fundWallet = async () => {
    if (!created || !sdk) return; setError(null); setBusy(true);
    try { setFunded(await sdk.fundCampaign(created.campaign_id)); } catch (e: any) { setError(`${e.code ?? "error"}: ${e.message}`); } finally { setBusy(false); }
    await refresh();
  };
  const fundDemo = async () => {
    if (!created) return; setError(null);
    const r = await fetch(`${API_BASE}/demo/fund/${created.campaign_id}`, { method: "POST" });
    if (!r.ok) setError(JSON.stringify(await r.json()));
    await refresh();
  };
  const refresh = async () => created && setStatus(await (await fetch(`${API_BASE}/campaigns/${created.campaign_id}`)).json());

  return (
    <>
      <section>
        <h2>Create a campaign</h2>
        <p className="row"><WalletMultiButton /><span className="muted">{sdk ? "Connected: the campaign is created and funded through the SDK with this wallet." : "Connect a wallet to fund with your own USDC, or create first and fund with the demo agent."}</span></p>
        <p className="muted">Advertisers buy reach, not lists: the server snapshots the audience (a segment such as <code>dex_swap_30d</code> ∩ registered identities, or all registered identities when untargeted) into a Merkle root. Every viewer is a verified human; targeting sets the price. Funding is one x402 request.</p>
        <form onSubmit={create}>
          <label>Advertiser wallet (receives unspent budget; defaults to the connected wallet)</label><input required={!sdk} value={form.advertiser} onChange={set("advertiser")} placeholder="pubkey" />
          <label>Title</label><input required value={form.title} onChange={set("title")} />
          <label>Image URL</label><input required value={form.image_url} onChange={set("image_url")} />
          <label>Click-through URL</label><input required value={form.cta_url} onChange={set("cta_url")} />
          <label>Audience</label>
          <select value={form.audience} onChange={set("audience")}>
            <option value="dex_swap_30d">Targeted: dex_swap_30d (verified humans active on a DEX in 30 days) · suggested $0.50–1.00</option>
            <option value="">Untargeted: every verified human · suggested $0.10–0.25</option>
          </select>
          <label>Test audience (devnet demo only): up to 5 wallet addresses, one per line. These registered wallets become the audience, whatever is selected above (they must have opted in first). Leave empty for the real audience.</label>
          <textarea rows={3} value={form.test_wallets} onChange={set("test_wallets")} placeholder="your wallet, so you can test the reward" />
          <div className="row">
            <div><label>Price per view (USDC)</label><input type="number" step="0.01" min="0.01" value={form.price_per_view} onChange={set("price_per_view")} /></div>
            <div><label>Budget (USDC)</label><input type="number" step="0.1" min="0.1" value={form.budget} onChange={set("budget")} /></div>
            <div><label>Views per person per day</label><input type="number" min="1" max="255" value={form.freq_cap} onChange={set("freq_cap")} /></div>
          </div>
          <p><button type="submit">Create (Draft)</button></p>
        </form>
        {error && !created && <pre>{error}</pre>}
      </section>
      {created && (
        <section>
          <h2>Campaign {created.campaign_id} · reach {created.reachable}</h2>
          <p>Escrow <a href={explorer(created.escrow_ata, "address")} target="_blank" rel="noopener"><code>{created.escrow_ata.slice(0, 10)}…</code></a> · <a href={explorer(created.create_tx)} target="_blank" rel="noopener">create tx</a></p>
          <p className="row">
            <button onClick={fundWallet} disabled={!sdk || busy}>{busy ? "Paying…" : `Fund ${form.budget} USDC with my wallet (x402)`}</button>
            <span className="muted">{sdk ? "One USDC transfer signed by your wallet; the server escrows it and activates the campaign." : "Connect a wallet to pay yourself."}</span>
          </p>
          {funded && <p><b>Funded and active.</b> <a href={explorer(funded.settle_tx)} target="_blank" rel="noopener">x402 settlement</a> · <a href={explorer(funded.activate_tx)} target="_blank" rel="noopener">activate tx</a></p>}
          {error && <pre>{error}</pre>}
          <p>Or fund it from anywhere over x402 (any x402 client, including an AI agent):</p>
          <pre>{`curl -i -X POST ${created.fund_url}\n# → 402 PAYMENT-REQUIRED; then with an x402 client:\nX402_DEMO_SECRET=<json keypair> pnpm fund:demo ${API_BASE}`}</pre>
          <pre>{`import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";\nimport { ExactSvmScheme } from "@x402/svm/exact/client";\nconst pay = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", client: new ExactSvmScheme(signer) }] });\nawait pay("${created.fund_url}", { method: "POST" }); // settles ${form.budget} USDC, campaign goes Active`}</pre>
          <p className="row"><button onClick={fundDemo}>Fund with demo agent (devnet)</button><button onClick={refresh}>Refresh status</button>{status && <span>status: <b>{status.status}</b> · spent {(status.spent / 1e6).toFixed(2)} / {(status.budget / 1e6).toFixed(2)} USDC</span>}</p>
        </section>
      )}
    </>
  );
}
