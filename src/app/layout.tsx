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

export const metadata: Metadata = {
  title: "Pixelforge — Image Tools",
  description: "Remove backgrounds, vectorize logos. Self-hosted and private.",
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