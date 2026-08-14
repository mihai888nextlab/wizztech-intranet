import "@/styles/globals.css";
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
  return (
    <ThemeProvider>
      <Head>
        <title>WizzTech Intranet</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="color-scheme" content="light dark" />
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
