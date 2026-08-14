import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import webpush from "web-push";

import {
  buildPayload,
  buildRequestDetails,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  PUSH_TTL_SECONDS,
  sendToSubscription,
  shouldPrune,
} from "./push";

describe("buildPayload", () => {
  it("passes short text through unchanged", () => {
    const out = buildPayload({ title: "Regionals", body: "Bus at 08:15", url: "/a" });
    assert.deepEqual(out, { title: "Regionals", body: "Bus at 08:15", url: "/a" });
  });

  it("clamps the title and body the OS would truncate anyway", () => {
    const out = buildPayload({
      title: "T".repeat(200),
      body: "B".repeat(400),
      url: "/a",
    });
    assert.equal(out.title.length, PUSH_TITLE_MAX);
    assert.equal(out.body.length, PUSH_BODY_MAX);
    assert.ok(out.title.endsWith("…"));
  });

  it("collapses newlines, which lock screens render as spaces regardless", () => {
    const out = buildPayload({ title: "a\n\nb", body: "c\n  d", url: "/a" });
    assert.equal(out.title, "a b");
    assert.equal(out.body, "c d");
  });

  it("omits an absent tag rather than sending undefined", () => {
    assert.equal("tag" in buildPayload({ title: "a", body: "b", url: "/c" }), false);
    assert.equal(buildPayload({ title: "a", body: "b", url: "/c", tag: "x" }).tag, "x");
  });
});

describe("shouldPrune", () => {
  it("prunes only on a permanently gone endpoint", () => {
    assert.equal(shouldPrune(404), true);
    assert.equal(shouldPrune(410), true);
  });

  it("keeps the subscription for anything transient", () => {
    // Deleting on a 429 or a 500 would throw away working devices during an
    // outage — exactly when notifications matter.
    for (const status of [201, 400, 401, 403, 429, 500, 502, 503, undefined]) {
      assert.equal(shouldPrune(status), false, `status ${status} must not prune`);
    }
  });
});

/*
  A stand-in push service. Real delivery needs a browser and Google's or
  Mozilla's infrastructure, but everything this app is responsible for — VAPID
  signing, aes128gcm encryption, headers — happens before that hop, so it can
  be inspected here.
*/
describe("the request we actually send", () => {
  let server: Server;
  let base: string;
  let lastRequest: { headers: IncomingMessage["headers"]; body: Buffer } | null = null;
  let respondWith = 201;

  before(async () => {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.VAPID_SUBJECT = "mailto:test@example.com";

    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        lastRequest = { headers: req.headers, body: Buffer.concat(chunks) };
        res.writeHead(respondWith).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  after(() => server.close());

  /** A real subscription's keys are a P-256 public point and 16 random bytes. */
  function fakeSubscription(path = "/push/abc") {
    return {
      endpoint: `${base}${path}`,
      keys: {
        p256dh: webpush.generateVAPIDKeys().publicKey,
        auth: Buffer.from("0123456789abcdef").toString("base64url"),
      },
    };
  }

  it("is VAPID-signed and encrypted before it leaves", async () => {
    const details = await buildRequestDetails(fakeSubscription(), {
      title: "Regionals",
      body: "Bus leaves at 08:15",
      url: "/announcements#a-1",
    });

    assert.match(
      String(details.headers.Authorization),
      /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/,
      "Authorization must carry a VAPID JWT and the public key"
    );
    assert.equal(details.headers["Content-Encoding"], "aes128gcm");
    assert.equal(Number(details.headers.TTL), PUSH_TTL_SECONDS);
    assert.ok(details.body.length > 0, "body should not be empty");
    assert.ok(
      !details.body.toString("utf8").includes("Regionals"),
      "payload must never travel in the clear"
    );
  });

  it("reaches the push service with those headers intact", async () => {
    respondWith = 201;
    const result = await sendToSubscription(fakeSubscription(), {
      title: "Regionals",
      body: "Bus leaves at 08:15",
      url: "/a",
    });

    assert.equal(result.ok, true);
    assert.equal(result.prune, false);
    assert.ok(lastRequest, "the push service should have been called");
    assert.match(String(lastRequest!.headers.authorization), /^vapid t=/);
    assert.equal(lastRequest!.headers["content-encoding"], "aes128gcm");
    assert.ok(lastRequest!.headers.ttl, "TTL is required by the Web Push spec");
    assert.ok(lastRequest!.body.length > 0);
  });

  it("reports a dead endpoint as prunable instead of throwing", async () => {
    respondWith = 410;
    const result = await sendToSubscription(fakeSubscription("/push/gone"), {
      title: "x",
      body: "y",
      url: "/",
    });
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 410);
    assert.equal(result.prune, true);
  });

  it("does not prune on a server error", async () => {
    respondWith = 503;
    const result = await sendToSubscription(fakeSubscription("/push/down"), {
      title: "x",
      body: "y",
      url: "/",
    });
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 503);
    assert.equal(result.prune, false);
  });

  it("does not prune when the push service is unreachable", async () => {
    // A refused connection says nothing about whether the device is still
    // subscribed — deleting here would lose good rows during an outage.
    const result = await sendToSubscription(
      {
        endpoint: "http://127.0.0.1:1/push/nope",
        keys: {
          p256dh: webpush.generateVAPIDKeys().publicKey,
          auth: Buffer.from("0123456789abcdef").toString("base64url"),
        },
      },
      { title: "x", body: "y", url: "/" },
      { timeoutMs: 1500 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.prune, false);
  });
});
