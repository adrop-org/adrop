"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { Adrop, type Ad, type IdentityStatus, type Reward } from "adrop-sdk";
import { API_BASE, HOST_ATA, USDC_MINT, explorer } from "../lib/config";
import { Balances } from "./Balances";

const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ataOf = (owner: PublicKey) => PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), new PublicKey(USDC_MINT).toBuffer()], ATA_PROGRAM)[0];

export function Viewer() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [identity, setIdentity] = useState<IdentityStatus | null>(null);
  const [ad, setAd] = useState<Ad | null | "none">(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [balance, setBalance] = useState<{ before?: number; after?: number }>({});
  const [sol, setSol] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const slot = useRef<HTMLDivElement>(null);
  const sdk = useRef<Adrop | null>(null);

  const usdc = useCallback(async () => {
    if (!wallet.publicKey) return 0;
    try { return Number((await connection.getTokenAccountBalance(ataOf(wallet.publicKey))).value.uiAmount ?? 0); } catch { return 0; }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    if (!wallet.publicKey || !wallet.signMessage || !wallet.signTransaction) { sdk.current = null; setIdentity(null); return; }
    sdk.current = Adrop.init({ apiBase: API_BASE, hostAta: HOST_ATA, wallet: { publicKey: wallet.publicKey, signMessage: wallet.signMessage, signTransaction: wallet.signTransaction } })
      .onError((e) => setError(`${e.code}: ${e.message}`));
    fetch(`${API_BASE}/identity/${wallet.publicKey.toBase58()}`).then((r) => r.json()).then(setIdentity).catch(() => {});
    usdc().then((b) => setBalance({ before: b }));
    connection.getBalance(wallet.publicKey).then((l) => setSol(l / 1e9)).catch(() => setSol(null));
  }, [wallet.publicKey, wallet.signMessage, wallet.signTransaction, usdc, connection]);

  const optIn = async () => { setError(null); setBusy(true); try { setIdentity(await sdk.current!.optIn()); } catch {} finally { setBusy(false); } };
  const loadAd = async () => {
    setError(null); setReward(null); setBusy(true);
    try {
      const a = await sdk.current!.loadAd();
      setAd(a ?? "none");
      if (a && slot.current) {
        setBalance({ before: await usdc() });
        sdk.current!.show(slot.current).then(async (r) => {
          setReward(r);
          setBalance((b) => ({ ...b, after: undefined }));
          const after = await usdc();
          setBalance((b) => ({ ...b, after }));
          setTick((t) => t + 1);
          setIdentity(await (await fetch(`${API_BASE}/identity/${wallet.publicKey!.toBase58()}`)).json());
        }).catch(() => {});
      }
    } catch {} finally { setBusy(false); }
  };

  return (
    <>
      <section>
        <h2>1. Connect a wallet</h2>
        <div className="row"><WalletMultiButton />{wallet.publicKey && <span className="muted">USDC: {balance.before ?? "…"} · SOL: {sol === null ? "…" : sol.toFixed(3)}</span>}</div>
      </section>
      <section>
        <h2>2. Opt in to Adrop</h2>
        <p className="muted">One Seeker Genesis Token → one identity. On devnet the token is a mock of the same Token-2022 layout; mainnet uses group <code>GT22s89…</code>.</p>
        {identity && (
          <p>
            {identity.has_sgt ? "Genesis Token found" : "No Genesis Token in this wallet"}{identity.sgt_mint && <> · mint <a href={explorer(identity.sgt_mint, "address")} target="_blank" rel="noopener"><code>{identity.sgt_mint.slice(0, 8)}…</code></a></>}
            <br />{identity.registered ? <>Identity registered{"identity" in identity && <> · <a href={explorer((identity as any).identity, "address")} target="_blank" rel="noopener">PDA on explorer</a></>} · views today: {identity.views_today ?? 0}</> : "Not registered yet"}
          </p>
        )}
        {identity && !identity.has_sgt && (
          <p className="hint">No Genesis Token here, so this wallet cannot opt in. On a Seeker phone the token is found automatically.
            On devnet, mock tokens are minted by the Adrop team (<code>pnpm sgt:mock</code>, group authority required); the demo wallet already holds one.</p>
        )}
        {identity && identity.has_sgt && !identity.registered && sol === 0 && (
          <p className="hint">This wallet has 0 SOL. Registration needs about 0.002 SOL for the identity account; Phantom closes without a message otherwise.
            Devnet: <a href="https://faucet.solana.com" target="_blank" rel="noopener">faucet.solana.com</a>. Claims later need no SOL: the fee payer covers them.</p>
        )}
        <button onClick={optIn} disabled={!sdk.current || busy || !!identity?.registered}>{identity?.registered ? "Opted in" : "Opt in"}</button>
      </section>
      <section>
        <h2>3. Watch an ad, get paid</h2>
        <div className="row"><button onClick={loadAd} disabled={!identity?.registered || busy}>Load ad</button>{ad === "none" && <span className="muted">No campaign available for this identity right now.</span>}</div>
        <div ref={slot} style={{ marginTop: 12 }} />
        {reward && (
          <p>Paid <b>{(reward.amount / 1e6).toFixed(2)} USDC</b> · <a href={explorer(reward.tx)} target="_blank" rel="noopener">transaction</a><br />
            <span className="muted">USDC {balance.before?.toFixed(2)} → {balance.after?.toFixed(2)} · 70% viewer / 20% this app / 10% protocol</span></p>
        )}
      </section>
      {error && <section style={{ borderColor: "#c33" }}><b>Error</b> <code>{error}</code></section>}
      <Balances viewerAta={wallet.publicKey ? ataOf(wallet.publicKey).toBase58() : undefined} campaignId={ad && ad !== "none" ? ad.campaign.id : undefined} refreshKey={tick} />
    </>
  );
}
