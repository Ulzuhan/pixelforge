import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { KaiCorpFooter } from "@/components/kaicorp-footer";
import { KaiCorpHeader } from "@/components/kaicorp-header";

// Force dynamic rendering — prevents aggressive caching by Cloudflare
export const dynamic = "force-dynamic";

// La marca: display para titulares, sans para lectura, mono para etiquetas.
const display = Space_Grotesk({ variable: "--font-display", weight: ["500", "700"], subsets: ["latin"] });
const sans = Inter({ variable: "--font-sans", weight: ["400", "500"], subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", weight: ["400", "500"], subsets: ["latin"] });

/**
 * The public origin, for canonical and social previews.
 *
 * It comes from PIXELFORGE_PUBLIC_HOST, which already exists for the origin
 * check: no new variable, and whoever deploys this on their own domain gets
 * their own canonical without touching code. Unset, none is emitted — Next
 * would otherwise resolve relative URLs against localhost, and a canonical
 * pointing at localhost is worse than no canonical at all.
 */
const publicHost = process.env.PIXELFORGE_PUBLIC_HOST?.trim();
const base = publicHost ? new URL(`https://${publicHost}`) : undefined;

const TITLE = "Pixelforge — background removal and vectorisation, self-hosted";
const DESCRIPTION =
  "Cut the background out of a photo or turn a logo into a scalable vector, on hardware you control. Full resolution, no watermark, nothing kept afterwards.";

export const metadata: Metadata = {
  ...(base ? { metadataBase: base, alternates: { canonical: "/" } } : {}),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Pixelforge",
    locale: "en_US",
    ...(base ? { url: "/", images: [{ url: "/og.jpg", width: 760, height: 475, alt: "Pixelforge: a photo before and after its background is removed" }] } : {}),
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <KaiCorpHeader app="Pixelforge" />
        {children}
        <KaiCorpFooter current="pixelforge" />
      </body>
    </html>
  );
}