import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/react-query";
import { PostHogProvider } from "@/providers/posthog-provider";
import CookieConsent from "@/components/CookieConsent";
import { AuthSessionProvider } from "@/providers/auth-session-provider";
import AuthStoreSync from "@/providers/auth-store-sync";

const defaultSiteUrl = "https://alignai.com";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl;
const metadataBase = (() => {
  try {
    return new URL(siteUrl);
  } catch {
    return new URL(defaultSiteUrl);
  }
})();
const resolvedSiteUrl = metadataBase.toString().replace(/\/$/, "");
const siteDescription =
  "Lossless script conversion powered by advanced neural mapping. Built for developers, linguists, and the global web.";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase,
  title: "TranslitAI",
  description: siteDescription,
  applicationName: "TranslitAI",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TranslitAI",
    title: "TranslitAI",
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TranslitAI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TranslitAI",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TranslitAI",
  url: resolvedSiteUrl,
  description: siteDescription,
  publisher: {
    "@type": "Organization",
    name: "TranslitAI",
    logo: {
      "@type": "ImageObject",
      url: `${resolvedSiteUrl}/icon.svg`,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <AuthSessionProvider>
          <PostHogProvider>
            <ReactQueryProvider>
              <AuthStoreSync />
              {children}
              <CookieConsent />
            </ReactQueryProvider>
          </PostHogProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
