/*
  Drawing a volunteer's badge QR. Server-side on purpose: the encoder is a few
  tens of kilobytes that no page needs in its bundle, and the badge code it
  encodes should not be handed to the client at all — the browser only ever
  sees an <img> pointing at one of the qr routes.
*/
import type { NextApiRequest, NextApiResponse } from "next";
import QRCode from "qrcode";

/**
 * What the code resolves to when scanned. An absolute URL rather than a bare
 * token, so any phone camera offers to open it — the scan features to come can
 * then live behind /v/<code> without the printed badges needing a reprint.
 */
export function badgeUrl(req: NextApiRequest, badgeCode: string) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0] ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000";
  return `${proto}://${Array.isArray(host) ? host[0] : host}/v/${badgeCode}`;
}

/**
 * Sends the QR as SVG so it stays sharp on a phone screen and on paper alike.
 * The routes that call this are named `qr`, not `qr.svg`, on purpose: the
 * matcher in `src/proxy.ts` skips anything ending in an image extension so the
 * PWA icons stay public, and a route that opts out of the proxy also opts out
 * of the volunteer allow-list. The content type is what makes it an image.
 * Black on transparent: the badge card paints its own white quiet zone, which
 * is what a scanner needs, and which a theme switch must not invert.
 */
export async function sendBadgeQr(req: NextApiRequest, res: NextApiResponse, badgeCode: string) {
  const svg = await QRCode.toString(badgeUrl(req, badgeCode), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#00000000" },
  });

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  // Private: a badge code identifies one person, so no shared cache may hold it.
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.status(200).send(svg);
}
