#!/usr/bin/env bash
# Creates the bucket and a least-privilege access key for the app.
#
# Run on the VPS, from this directory, after `podman-compose up -d`.
# Requires the `mc` client:
#   curl -sSLo /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc
#   chmod +x /usr/local/bin/mc
#
#   ./bootstrap.sh
#
# Prints the two values to paste into Vercel as S3_ACCESS_KEY_ID and
# S3_SECRET_ACCESS_KEY. The root credentials stay on the VPS and are never
# given to the app.

set -euo pipefail

cd "$(dirname "$0")"
[[ -f .env ]] || { echo "Create .env first (copy env.example)."; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a

BUCKET="${BUCKET:-wizztech-documents}"
APP_USER="${APP_USER:-wizztech-app}"
ALIAS=wizzlocal

# Talk to MinIO directly on localhost, bypassing the proxy — this script is
# about provisioning, not about testing the public path.
mc alias set "$ALIAS" "http://127.0.0.1:9000" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
echo "connected to MinIO"

if mc ls "$ALIAS/$BUCKET" >/dev/null 2>&1; then
  echo "bucket $BUCKET already exists"
else
  mc mb "$ALIAS/$BUCKET"
fi

# Private is the default, but be explicit: these are signed medical forms.
mc anonymous set none "$ALIAS/$BUCKET" >/dev/null
echo "bucket is private (no anonymous access)"

APP_SECRET="$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"

mc admin policy create "$ALIAS" wizztech-docs-rw ./app-policy.json 2>/dev/null \
  || mc admin policy update "$ALIAS" wizztech-docs-rw ./app-policy.json
echo "policy wizztech-docs-rw applied"

if mc admin user info "$ALIAS" "$APP_USER" >/dev/null 2>&1; then
  echo "user $APP_USER exists; rotating its secret"
  mc admin user remove "$ALIAS" "$APP_USER" >/dev/null
fi
mc admin user add "$ALIAS" "$APP_USER" "$APP_SECRET" >/dev/null
mc admin policy attach "$ALIAS" wizztech-docs-rw --user "$APP_USER" >/dev/null
echo "user $APP_USER created and scoped to $BUCKET"

# Confirm the CORS origins MinIO actually loaded.
echo
echo "CORS allowed origins:"
mc admin config get "$ALIAS" api 2>/dev/null | tr ' ' '\n' | grep cors_allow_origin || \
  echo "  (from MINIO_API_CORS_ALLOW_ORIGIN: ${CORS_ORIGINS})"

cat <<EOF

────────────────────────────────────────────────────────────
Set these in Vercel (and your local .env):

  S3_ENDPOINT="https://${S3_DOMAIN}"
  S3_REGION="us-east-1"
  S3_BUCKET="${BUCKET}"
  S3_ACCESS_KEY_ID="${APP_USER}"
  S3_SECRET_ACCESS_KEY="${APP_SECRET}"

The secret is shown once. Re-run this script to rotate it.
────────────────────────────────────────────────────────────
EOF
