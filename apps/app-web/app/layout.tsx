import type { Metadata, Viewport } from "next";
import { Providers } from "../components/Providers";
import "./globals.css";

export const metadata: Metadata = { title: "Adrop", description: "Push one campaign into every app in the network. Every view pays the verified person who watched it.", icons: { icon: "/favicon.svg" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap" />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
