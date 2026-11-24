import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { KaiCorpFooter } from "@/components/kaicorp-footer";
import { KaiCorpHeader } from "@/components/kaicorp-header";
import { KaiCorpAccountMenu } from "@/components/kaicorp-account-menu";
import { KaiCorpThemeToggle } from "@/components/kaicorp-theme-toggle";
import { currentAccount } from "@/lib/auth";
import { accountUrl } from "@/lib/oidc";

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("color-scheme");if(s==="light"||s==="dark"){var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content=s;}}catch(_){}})();`;

// Force dynamic rendering — prevents aggressive caching by Cloudflare
export const dynamic = "force-dynamic";

// La marca: display para titulares, sans para lectura, mono para etiquetas.
// Los nombres de las variables son los que espera kaicorp.css.
const display = Space_Grotesk({ variable: "--font-display", weight: ["500", "600", "700"], subsets: ["latin"] });
const sans = Inter({ variable: "--font-sans", weight: ["400", "500", "600"], subsets: ["latin"] });
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
    ...(base ? { url: "/", images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Pixelforge: a photo before and after its background is removed" }] } : {}),
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#070a12" },
  ],
};

/**
 * La cuenta se resuelve aquí: el menú de cuenta es el cromado común de las
 * cinco aplicaciones, en el mismo sitio en todas.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [account, reqHeaders] = await Promise.all([currentAccount(), headers()]);
  const nonce = reqHeaders.get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <KaiCorpHeader
          app="Pixelforge"
          current="pixelforge"
          showSwitcher={Boolean(process.env.KAICORP_FOOTER_LINKS?.trim())}
          signedIn={Boolean(account)}
        >
          <div className="flex items-center gap-2">
            {account ? (
              <KaiCorpAccountMenu email={account.email} name={account.name} accountUrl={accountUrl()} />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/api/auth/login" className="btn btn-secondary btn-sm">
                  Sign in
                </a>
              </>
            )}
            <KaiCorpThemeToggle />
          </div>
        </KaiCorpHeader>
        {children}
        <KaiCorpFooter current="pixelforge" />
      </body>
    </html>
  );
}
