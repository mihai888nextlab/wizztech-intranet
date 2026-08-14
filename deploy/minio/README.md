# MinIO on the VPS

Self-hosted S3 storage for document requests. The app talks plain S3, so this is
a drop-in alternative to Cloudflare R2 — only the `S3_*` variables change.

## Where the time actually goes

Worth knowing before tuning anything, because it changes what's worth doing:

```
phone ──── 6 MB upload ────► your VPS        (the only large transfer)
                                  ▲
Vercel ─── 2 small calls ─────────┘          (presign is local; probe + delete are hops)
```

File bytes never pass through Vercel. Uploads go browser → VPS directly via a
presigned URL. Your API only makes a couple of tiny calls per submission.

So the things that measurably affect speed, in order:

1. **The reverse-proxy config** — `proxy_request_buffering off` and no body-size
   cap. Get this wrong and every upload is written to nginx's temp directory in
   full before MinIO sees a byte.
2. **VPS uplink bandwidth** — the hard ceiling on upload speed. Measure it.
3. **Serverless region** — `vercel.json` pins functions to `fra1` (Frankfurt).
   Left on a US default, each small API call crosses the Atlantic twice.
4. **MinIO's own settings** — effectively irrelevant at a team's scale. Single-node
   single-drive mode has no erasure-coding overhead and is already the fast path.

Don't spend time on MinIO tuning guides. Spend it on 1–3 and on backups.

## Setup

Assumes you already have a reverse proxy terminating TLS, and two DNS names
pointing at the VPS (e.g. `s3.` for the API, `console.` for the admin UI).

```bash
# On the VPS
mkdir -p /srv/minio/data
cd /path/to/deploy/minio
cp env.example .env && nano .env        # set passwords, domains, CORS origins
podman-compose up -d                   # or: docker compose up -d
```

Then add the vhost for your proxy:

- **nginx** → copy `nginx-s3.conf`, fix the `server_name` and certificate paths,
  `nginx -t && systemctl reload nginx`
- **Caddy** → append `Caddyfile.snippet` to your Caddyfile and reload

Finally provision the bucket and a scoped key:

```bash
./bootstrap.sh
```

It prints the five `S3_*` values. Put them in Vercel and your local `.env`.
Root credentials never leave the VPS — the app gets a key limited to one bucket.

## Verify before trusting it

```bash
# 1. Proxy passes the Host header through (see the warning below)
curl -sI https://s3.example.com/minio/health/live | head -1

# 2. CORS preflight answers for your app origin
curl -si -X OPTIONS https://s3.example.com/wizztech-documents/probe \
  -H 'Origin: https://wizztech.example.com' \
  -H 'Access-Control-Request-Method: PUT' | grep -i access-control

# 3. Real uplink bandwidth, which is your true upload ceiling
#    (run on the VPS)
curl -so /dev/null -w 'down %{speed_download} B/s\n' https://speed.cloudflare.com/__down?bytes=100000000
```

Then upload a real document through the app and watch it land:

```bash
mc alias set L http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc ls --recursive L/wizztech-documents
```

## The mistake that will bite you

**nginx replaces the `Host` header by default**, and SigV4 signs that header.
Every presigned upload then fails with `SignatureDoesNotMatch` — a 403 that
looks like a credentials problem but isn't.

This is verified, not theoretical. The same 4 MB upload through two otherwise
identical nginx blocks:

| Config | Result |
|---|---|
| `proxy_set_header Host $http_host;` | `200 OK` |
| nginx default (line omitted) | `403 SignatureDoesNotMatch` |

Caddy preserves `Host` by default, which is why its config is three lines.

The second trap: **do not add `Access-Control-Allow-Origin` in the proxy**. MinIO
already sends CORS headers, and duplicates make browsers reject the upload with
an opaque error.

## Backups — do not skip this

Self-hosting means losing these files is now your problem, and they are signed
medical and consent forms. One disk, no backup, is not acceptable for that.

Cheapest sound option is to mirror to object storage off the box:

```bash
mc alias set r2 https://<account>.r2.cloudflarestorage.com <key> <secret>
mc mirror --overwrite --remove L/wizztech-documents r2/wizztech-docs-backup
```

Put it on a timer:

```bash
# /etc/systemd/system/minio-backup.timer  (daily)
# or simply:
0 3 * * * /usr/local/bin/mc mirror --overwrite L/wizztech-documents r2/wizztech-docs-backup
```

Test a restore once. An untested backup is a guess.

## Trade-off vs R2

R2 needs no maintenance, has no uptime risk you own, and costs nothing at this
volume. MinIO on your VPS means the data is yours, but you own uptime, disk
failure, TLS renewal and backups — and if the VPS is down, uploads fail.

Both work with identical app code, so you can run MinIO and switch to R2 later
by changing five environment variables.
