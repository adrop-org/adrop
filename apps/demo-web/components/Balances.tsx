"use client";
import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { API_BASE, HOST_ATA, explorer } from "../lib/config";

type Row = { label: string; who: string; ata?: string; share: string };
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

// Every USDC account touched by one paid view, with live balances. Demo-only transparency panel.
export function Balances({ viewerAta, campaignId, refreshKey }: { viewerAta?: string; campaignId?: number; refreshKey: number }) {
  const { connection } = useConnection();
  const [treasury, setTreasury] = useState<string>();
  const [escrow, setEscrow] = useState<string>();
  const [bal, setBal] = useState<Record<string, number | null>>({});

  useEffect(() => { fetch(`${API_BASE}/health`).then((r) => r.json()).then((h) => setTreasury(h.treasury_ata)).catch(() => {}); }, []);
  useEffect(() => {
    if (campaignId == null) return setEscrow(undefined);
    fetch(`${API_BASE}/campaigns/${campaignId}`).then((r) => r.json()).then((c) => setEscrow(c.escrow_ata)).catch(() => {});
  }, [campaignId]);

  const rows: Row[] = [
    { label: "Campaign escrow", who: campaignId != null ? `campaign ${campaignId} (program PDA)` : "no ad loaded", ata: escrow, share: "pays out" },
    { label: "Viewer (you)", who: "your wallet", ata: viewerAta, share: "70%" },
    { label: "Host app", who: "this demo site", ata: HOST_ATA || undefined, share: "20%" },
    { label: "Protocol", who: "Adrop treasury", ata: treasury, share: "10%" },
  ];

  const load = useCallback(async () => {
    const out: Record<string, number | null> = {};
    await Promise.all(rows.filter((r) => r.ata).map(async (r) => {
      try { out[r.ata!] = Number((await connection.getTokenAccountBalance(new PublicKey(r.ata!))).value.uiAmount ?? 0); } catch { out[r.ata!] = null; }
    }));
    setBal(out);
  }, [connection, viewerAta, escrow, treasury]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <section>
      <h2>Who gets paid</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "6px 0" }}><b>{r.label}</b><br /><span className="muted">{r.who}</span></td>
              <td><code>{r.ata ? <a href={explorer(r.ata, "address")} target="_blank" rel="noopener">{short(r.ata)}</a> : "—"}</code></td>
              <td className="muted">{r.share}</td>
              <td style={{ textAlign: "right" }}>{r.ata ? (bal[r.ata] == null ? (r.ata in bal ? "no account" : "…") : `${bal[r.ata]!.toFixed(2)} USDC`) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ marginBottom: 0 }}>Balances read from devnet. One qualified view moves price_per_view from escrow to the three accounts in one transaction.</p>
    </section>
  );
}
