"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import QRCode from "qrcode";
import { Adrop, type Ad, type IdentityStatus, type Reward } from "adrop-sdk";
import { get, type Stats } from "../lib/api";
import { API_BASE, APP_URL, FALLBACK_VIDEO, HOST_ATA, USDC_MINT, explorer, money, short } from "../lib/config";
import { SPLIT } from "../lib/mock";
import { SplitBar } from "./Shell";

const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ataOf = (owner: PublicKey) => PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), new PublicKey(USDC_MINT).toBuffer()], ATA_PROGRAM)[0];
type Screen = "connect" | "optin" | "cleared" | "ad" | "paid" | "offline";
const PLAY_URL = `${APP_URL}/play`;
const PHANTOM_URL = `https://phantom.app/ul/browse/${encodeURIComponent(PLAY_URL)}?ref=${encodeURIComponent(APP_URL)}`;

export function Play() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [screen, setScreen] = useState<Screen>("connect");
  const [level, setLevel] = useState(3);
  const [stats, setStats] = useState<Stats | null>(null);
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);
  const [ad, setAd] = useState<Ad | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [before, setBefore] = useState<Record<string, number>>({});
  const [after, setAfter] = useState<Record<string, number>>({});
  const [k, setK] = useState(1);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slot = useRef<HTMLDivElement>(null);
  const sdk = useRef<Adrop | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const split = SPLIT;

  useEffect(() => { QRCode.toString(PHANTOM_URL, { type: "svg", margin: 0, color: { dark: "#111111", light: "#0000" } }).then((svg) => setQr(svg.replace(/#111111/g, "currentColor"))).catch(() => {}); }, []);
  const ping = useCallback(() => get<Stats>("/stats").then((s) => { setStats(s); return true; }).catch(() => { setScreen("offline"); return false; }), []);
  useEffect(() => { ping(); }, [ping]);

  const treasury = useRef<string>();
  useEffect(() => { get<{ treasury_ata: string }>("/health").then((h) => { treasury.current = h.treasury_ata; }).catch(() => {}); }, []);
  const accounts = useCallback(() => ({ viewer: wallet.publicKey ? ataOf(wallet.publicKey).toBase58() : "", host: HOST_ATA, protocol: treasury.current ?? "" }), [wallet.publicKey]);
  const balances = useCallback(async () => {
    const out: Record<string, number> = {};
    await Promise.all(Object.entries(accounts()).map(async ([k, a]) => { try { out[k] = a ? Number((await connection.getTokenAccountBalance(new PublicKey(a))).value.uiAmount ?? 0) : 0; } catch { out[k] = 0; } }));
    return out;
  }, [accounts, connection]);

  useEffect(() => {
    if (!wallet.publicKey || !wallet.signMessage || !wallet.signTransaction) { sdk.current = null; if (screen !== "offline") setScreen("connect"); return; }
    sdk.current = Adrop.init({ apiBase: API_BASE, hostAta: HOST_ATA, wallet: { publicKey: wallet.publicKey, signMessage: wallet.signMessage, signTransaction: wallet.signTransaction } }).onError((e) => setError(`${e.code}: ${e.message}`));
    get<IdentityStatus>(`/identity/${wallet.publicKey.toBase58()}`).then((id) => { setIdentity(id); setScreen((s) => s === "offline" ? s : id.registered ? "cleared" : "optin"); }).catch(() => setScreen("offline"));
  }, [wallet.publicKey, wallet.signMessage, wallet.signTransaction]); // eslint-disable-line react-hooks/exhaustive-deps

  const optIn = async () => {
    setError(null); setBusy(true);
    try {
      if (!identity?.has_sgt) {
        const r = await fetch(`${API_BASE}/demo/mint-sgt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: wallet.publicKey!.toBase58() }) });
        if (!r.ok) throw new Error(JSON.stringify(await r.json()));
        await new Promise((ok) => setTimeout(ok, 2500));
      }
      const id = await sdk.current!.optIn(); setIdentity(id); if (id.registered) setScreen("cleared");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const watch = async () => {
    setError(null); setBusy(true); setReward(null);
    try {
      if (!(await ping())) return;
      const a = await sdk.current!.loadAd(stats?.demo_campaign_id ?? undefined).catch(() => sdk.current!.loadAd());
      if (!a) { setError("No campaign has budget for this wallet right now."); return; }
      setAd(a); setScreen("ad"); setBefore(await balances());
      requestAnimationFrame(() => {
        if (!slot.current) return;
        sdk.current!.show(slot.current).then(async (r) => {
          setReward(r); setScreen("paid"); setK(0);
          const b = await balances(); setAfter(b);
          const start = performance.now();
          const step = (now: number) => { const t = Math.min(1, (now - start) / 900); setK(1 - Math.pow(1 - t, 3)); if (t < 1) requestAnimationFrame(step); };
          setTimeout(() => requestAnimationFrame(step), 500);
        }).catch(() => setScreen("cleared"));
      });
    } catch (e: any) { setError(e.message); setScreen("cleared"); } finally { setBusy(false); }
  };

  const reset = () => { setScreen(identity?.registered ? "cleared" : wallet.publicKey ? "optin" : "connect"); setLevel(3); setAd(null); setReward(null); setError(null); setK(1); };
  const holdStart = () => { hold.current = setTimeout(reset, 1000); };
  const holdEnd = () => { if (hold.current) clearTimeout(hold.current); };

  const price = ad ? ad.campaign.price_per_view / 1e6 : 0.5;
  const viewerAmt = price * split.viewer / 10_000;
  const hostAmt = price * split.host / 10_000, protoAmt = price - viewerAmt - hostAmt;
  const tick = (key: string, delta: number) => money((before[key] ?? 0) + (after[key] != null ? (after[key] - (before[key] ?? 0)) * k : delta * k), true);
  const acc = accounts();

  return (
    <div className="stage">
      <a className="back" href="/">Back to console ✕</a>
      <div className="phone">
        <div className="hud"><span className="lvl">Level {level}</span><span className="tag">a game running the Adrop SDK</span><span className="score">12,480</span></div>

        {screen === "connect" && (
          <div className="screen cleared">
            <div className="block" aria-hidden><div className="ball" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><h1>Get paid for <em className="coin">every ad</em> you watch.</h1><p>Opt in once with your wallet. Each view pays you in USDC, straight to your wallet.</p></div>
            <div className="bottom"><WalletMultiButton style={{ width: "100%", justifyContent: "center", fontSize: 20, padding: "20px 24px" }}>Connect wallet</WalletMultiButton><span className="note">Phantom or Solflare · Solana devnet</span></div>
          </div>
        )}

        {screen === "optin" && (
          <div className="screen cleared">
            <div className="block" aria-hidden><div className="ball" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><h1>One person, <em className="coin">one</em> identity.</h1><p>{identity?.has_sgt ? "Genesis Token found. Register once; every ad after this pays you." : "No Genesis Token in this wallet yet. On devnet the demo mints a mock one, then registers you."}</p></div>
            <div className="bottom"><button className="btn btn-lg" disabled={busy || !sdk.current} onClick={optIn}>{busy ? "One moment…" : "Opt in"}</button><span className="note">One signature · about 0.002 SOL for the identity account</span>{error && <span className="error-line">{error}</span>}</div>
          </div>
        )}

        {screen === "cleared" && (
          <div className="screen cleared">
            <div className="block" aria-hidden><div className="ball" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><h1>Level {level} <em className="coin">cleared</em>.</h1><p>Watch one ad before level {level + 1}. You get paid for it, not the other way round.</p></div>
            <div className="bottom"><button className="btn btn-lg" disabled={busy} onClick={watch}>{busy ? "Loading…" : "Watch an ad, get paid"}</button><span className="note">{money(viewerAmt, true)} in USDC · about 5 seconds · nothing to sign up for</span>{error && <span className="error-line">{error}</span>}</div>
          </div>
        )}

        {screen === "ad" && ad && (
          <div className="screen">
            <div className="adwrap">
              <div ref={slot} />
              <svg className="ring" viewBox="0 0 64 64" role="img" aria-label="Ad timer"><circle className="ring-track" cx="32" cy="32" r="28" /><circle className="ring-fill" cx="32" cy="32" r="28" transform="rotate(-90 32 32)" style={{ animationDuration: `${ad.campaign.min_dwell_ms}ms` }} /></svg>
            </div>
            <div className="bottom"><span className="note">Paid from the advertiser&apos;s escrow, not by the game. {money(viewerAmt, true)} of the {money(price, true)} view is yours.</span></div>
          </div>
        )}

        {screen === "paid" && reward && (
          <div className="screen" style={{ gap: 18 }}>
            <div className="paid-head">
              <svg width="88" height="88" viewBox="0 0 64 64" role="img" aria-label="The drop lands in the adrop tile"><path fill="#F5C518" d="M15 0H49A15 15 0 0 1 64 15V49A15 15 0 0 1 49 64H15A15 15 0 0 1 0 49V15A15 15 0 0 1 15 0Z" /><path className="drop-land" fill="#111111" d="M45.422 31.304A15 15 0 1 1 18.578 31.304L29.763 8.884A2.5 2.5 0 0 1 34.237 8.884Z" /></svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><span className="small mute">Paid to {wallet.publicKey ? short(wallet.publicKey.toBase58()) : "you"}</span><span className="paid-amt">{money(viewerAmt, true)}<i className="paid-pulse" aria-hidden /></span></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="label">Who gets paid · on a {money(price, true)} view · target split</span>
              <SplitBar bps={split} height={16} />
              <div className="split-numbers">
                <div><span className="n">{money(viewerAmt, true)}</span><span className="who">You</span><span className="role">viewer · {split.viewer / 100}%</span></div>
                <div><span className="n">{money(hostAmt, true)}</span><span className="who">This game</span><span className="role">app · {split.host / 100}%</span></div>
                <div><span className="n">{money(protoAmt, true)}</span><span className="who">Adrop</span><span className="role">protocol · {split.protocol / 100}%</span></div>
              </div>
            </div>
            <div className="balances">
              <div><span>{acc.viewer ? short(acc.viewer) : "you"} <span className="mute">· you</span></span><b>{tick("viewer", viewerAmt)}</b></div>
              <div><span>{acc.host ? short(acc.host) : "game"} <span className="mute">· this game</span></span><b>{tick("host", hostAmt)}</b></div>
              <div><span>{acc.protocol ? short(acc.protocol) : "Adrop"} <span className="mute">· protocol</span></span><b>{tick("protocol", protoAmt)}</b></div>
              <a href={explorer(reward.tx)} target="_blank" rel="noreferrer">One Solana transaction · on devnet ↗</a>
            </div>
            <div className="bottom"><a className="btn btn-lg btn-link" href="/">Back to console</a><button className="btn btn-secondary btn-lg" onClick={() => { setLevel(level + 1); setScreen("cleared"); setError(null); }}>Play level {level + 1}</button></div>
          </div>
        )}

        {screen === "offline" && (
          <div className="screen" style={{ position: "relative" }}>
            <div className="block" aria-hidden />
            <div className="offline">
              <h2>Network is slow here.</h2>
              <p>Devnet did not answer in 3 seconds. The recording shows the same flow, start to payout.</p>
              <a className="btn btn-link" href={FALLBACK_VIDEO}>Watch the 60-second recording</a>
              <button className="btn btn-secondary" onClick={() => ping().then((ok) => ok && reset())}>Try again</button>
            </div>
          </div>
        )}

        <div className="phone-foot">
          <div className="qr"><span aria-label="QR code for app.adrop.sh/play" role="img" dangerouslySetInnerHTML={{ __html: qr }} style={{ width: 48, height: 48, flex: "none", color: "var(--fg)" }} /><span>Try it on your phone<br />app.adrop.sh/play · opens in Phantom</span></div>
          <button className="hold" onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} aria-label="Hold for one second to reset the demo">Hold to reset</button>
        </div>
      </div>
    </div>
  );
}
