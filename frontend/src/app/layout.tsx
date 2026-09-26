import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const GeistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const GeistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sangam-botchain.vercel.app'),
  title: {
    default: 'sangam. — Rotating Savings on Botchain',
    template: '%s | sangam.',
  },
  description: 'Sangam — rotating savings on Botchain. A smart contract holds the pot, not a person.',
  openGraph: {
    title: 'sangam. — Rotating Savings on Botchain',
    description: 'Rotating savings on Botchain. A smart contract holds the pot, not a person.',
    siteName: 'sangam.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
        <Analytics />
      
        <footer style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid #eaeaea', textAlign: 'center', fontSize: '0.875rem', zIndex: 10, position: 'relative', backgroundColor: 'inherit', color: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span>Ecosystem Partner Botchain</span>
            <img src="https://botchain.ai/favicon.ico" alt="Botchain Logo" width={20} height={20} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <a href="https://botchain.ai" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>BOT Chain Official Website</a>
            <a href="https://scan.botchain.ai" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>BOT Chain Explorer</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
