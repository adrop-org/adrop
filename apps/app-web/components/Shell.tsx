"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export const Wordmark = ({ height = 28 }: { height?: number }) => (
  <picture><source srcSet="/wordmark-dark.svg" media="(prefers-color-scheme: dark)" /><img src="/wordmark.svg" alt="adrop" height={height} width={height * 3.7} style={{ height, width: "auto" }} /></picture>
);

export function Header() {
  return (
    <header className="header">
      <a href="/" className="brand" aria-label="adrop console"><Wordmark /></a>
      <div className="right"><span className="badge">Solana devnet</span><WalletMultiButton /></div>
    </header>
  );
}

export const Footer = () => (
  <footer className="footer">
    <span>Solana devnet</span>
    <a href="https://github.com/adrop-org/adrop" target="_blank" rel="noreferrer">github.com/adrop-org/adrop</a>
    <a href="https://adrop.sh" target="_blank" rel="noreferrer">adrop.sh</a>
  </footer>
);

export const SplitBar = ({ bps, height = 14 }: { bps: { viewer: number; host: number; protocol: number }; height?: number }) => (
  <div className="split" role="img" aria-label={`Split: viewer ${bps.viewer / 100} percent, app ${bps.host / 100} percent, protocol ${bps.protocol / 100} percent`} style={{ height }}>
    <div className="viewer" style={{ width: `${bps.viewer / 100}%` }} /><div className="app" style={{ width: `${bps.host / 100}%` }} /><div className="protocol" style={{ width: `${bps.protocol / 100}%` }} />
  </div>
);
