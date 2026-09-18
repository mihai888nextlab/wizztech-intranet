import "@/styles/globals.css";
import { useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function App({ Component, pageProps }: AppProps) {
  // Registered on every load, not just when notifications are switched on: the
  // worker is also what makes the app installable, and iOS needs it in place
  // before a subscription can ever be created.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.error("service worker registration failed", err));
  }, []);

  return (
    <ThemeProvider>
      <Head>
        <title>WizzTech Intranet</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="color-scheme" content="light dark" />
        {/* Installable on the Home Screen — the only route to push on iOS. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="WizzTech" />
        {/*
          Distinct keys are required: next/head dedupes meta by `name`, so
          without them the second theme-color silently replaces the first and
          the installed app keeps a light chrome in dark mode.
        */}
        <meta
          key="theme-color-light"
          name="theme-color"
          content="#f9fafb"
          media="(prefers-color-scheme: light)"
        />
        <meta
          key="theme-color-dark"
          name="theme-color"
          content="#0d0e12"
          media="(prefers-color-scheme: dark)"
        />
      </Head>
      {/*
        Lift the font variables to :root rather than a wrapper element —
        dialogs, menus and toasts render through portals on <body>, outside
        any wrapper, and would otherwise fall back to the system font.
      */}
      <style jsx global>{`
        :root {
          --font-geist-sans: ${geistSans.style.fontFamily};
          --font-geist-mono: ${geistMono.style.fontFamily};
        }
      `}</style>
      <TooltipProvider>
        <Component {...pageProps} />
        <Toaster position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
