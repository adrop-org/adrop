import type { Metadata } from "next";
import { Providers } from "../components/Providers";
import "./globals.css";

export const metadata: Metadata = { title: "Adrop demo", description: "Rewarded ads that pay the viewer in USDC", icons: { icon: "/favicon.svg" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <Providers>
        <header><a href="/" className="brand"><picture><source srcSet="/wordmark-dark.svg" media="(prefers-color-scheme: dark)" /><img src="/wordmark.svg" alt="adrop" height={28} width={104} /></picture> demo host</a><nav><a href="/">Viewer</a><a href="/advertiser">Advertiser</a></nav></header>
        <main>{children}</main>
        <footer>Solana devnet · <a href="https://github.com/adrop-org/adrop" target="_blank" rel="noopener">github.com/adrop-org/adrop</a></footer>
      </Providers>
    </body></html>
  );
}
