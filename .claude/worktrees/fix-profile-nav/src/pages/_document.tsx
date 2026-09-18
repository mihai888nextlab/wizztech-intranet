import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    // next-themes writes the theme class here before paint.
    <Html lang="en" suppressHydrationWarning>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
