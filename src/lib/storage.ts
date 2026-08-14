import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

/*
  The only module that talks to object storage.

  Everything here is plain S3, so the provider is a matter of configuration:
  Cloudflare R2 today, MinIO on a VPS or Backblaze later, with no code change.
  Files never pass through the API — Vercel caps serverless request bodies at
  roughly 4.5 MB — so the browser uploads straight to the bucket with a
  short-lived presigned URL and the API only signs and verifies.
*/

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60;
// Previews stay open in a dialog, so they get a little longer than a download.
const PREVIEW_URL_TTL_SECONDS = 5 * 60;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Document uploads need S3-compatible storage; see .env.example.`
    );
  }
  return value;
}

/** True when storage is configured, so routes can fail politely instead of crashing. */
export function isStorageConfigured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: requireEnv("S3_ENDPOINT"),
      region: process.env.S3_REGION || "auto",
      credentials: {
        accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
      },
      // R2 and MinIO both accept path-style; it avoids per-bucket DNS entirely.
      forcePathStyle: true,
    });
  }
  return client;
}

function bucket() {
  return requireEnv("S3_BUCKET");
}

/** Turns a user-supplied filename into something safe to embed in an object key. */
function safeObjectName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(-80)
    .replace(/^[.-]+/, "");
}

/**
 * Object key for a submission. The uuid keeps keys unguessable, but access is
 * still authorised on every request — the bucket itself is never public.
 */
export function submissionKey(
  requestId: number,
  userId: number,
  fileName: string
) {
  const safe = safeObjectName(fileName);
  return `requests/${requestId}/${userId}/${crypto.randomUUID()}-${safe || "file"}`;
}

/** Object key for a file attached to an announcement. */
export function attachmentKey(announcementId: number, fileName: string) {
  const safe = safeObjectName(fileName);
  return `announcements/${announcementId}/${crypto.randomUUID()}-${safe || "file"}`;
}

/** Presigned PUT. The client must send a matching Content-Type. */
export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );
}

/** Quotes and backslashes would break out of the header value. */
function headerSafe(fileName: string) {
  return fileName.replace(/["\\]/g, "");
}

/** Presigned GET that downloads under the member's original filename. */
export function presignDownload(key: string, fileName: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${headerSafe(fileName)}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
}

/**
 * Presigned GET that renders in the browser instead of downloading.
 *
 * `inline` is what makes a PDF open in the built-in viewer. The content type is
 * pinned to the sniffed value we stored, so the browser cannot be talked into
 * treating the file as something else.
 */
export function presignInline(
  key: string,
  fileName: string,
  contentType: string
) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: `inline; filename="${headerSafe(fileName)}"`,
    }),
    { expiresIn: PREVIEW_URL_TTL_SECONDS }
  );
}

/**
 * Readable stream of a stored object, for bundling into an archive.
 * Streamed rather than buffered so a whole team's files never sit in memory.
 */
export async function getObjectStream(key: string): Promise<Readable | null> {
  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key })
    );
    return res.Body ? (res.Body as Readable) : null;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw err;
  }
}

/**
 * Authoritative size, type and header bytes of a stored object.
 *
 * A presigned PUT can enforce neither a size limit nor a real file type, and
 * the client's own report of what it uploaded is not trustworthy, so every
 * submission is checked against this before it is recorded.
 *
 * Deliberately one round trip rather than two: a ranged GET reports the whole
 * object size in Content-Range ("bytes 0-15/4194313"), so there is no need to
 * HEAD as well. That matters when the bucket is on your own VPS, where each
 * call is a real network hop from the serverless function.
 *
 * Returns null when the object is absent.
 */
export interface ObjectProbe {
  size: number;
  /** Type as stored — uploader-chosen metadata, not proof of content. */
  contentType: string;
  /** Leading bytes, for identifying what the file actually is. */
  head: Buffer;
}

export async function probeObject(
  key: string,
  bytes = 16
): Promise<ObjectProbe | null> {
  try {
    const res = await s3().send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      })
    );
    const head = res.Body
      ? Buffer.from(await res.Body.transformToByteArray())
      : Buffer.alloc(0);
    const total = Number(res.ContentRange?.split("/").pop());
    return {
      size: Number.isFinite(total) ? total : (res.ContentLength ?? head.length),
      contentType: res.ContentType ?? "application/octet-stream",
      head,
    };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;
    const name = (err as { name?: string })?.name;

    if (status === 404 || name === "NoSuchKey" || name === "NotFound") {
      return null;
    }
    // A zero-byte object cannot satisfy a range request. Report it as empty so
    // type verification rejects it, instead of failing the whole request.
    if (status === 416 || name === "InvalidRange") {
      return {
        size: 0,
        contentType: "application/octet-stream",
        head: Buffer.alloc(0),
      };
    }
    throw err;
  }
}

/** Deletes stored objects. Safe to call with keys that no longer exist. */
export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  // DeleteObjects caps at 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      })
    );
  }
}

export function deleteObject(key: string) {
  return deleteObjects([key]);
}
