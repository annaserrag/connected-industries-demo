#!/usr/bin/env bash
# Publish the static build to a Hugging Face Space (SDK: static).
#
#   HF_TOKEN=hf_xxx HF_SPACE=your-user/get-your-clave npm run deploy:hf
#
# HF_TOKEN needs "write" access (huggingface.co/settings/tokens). The Space is created
# (public, static) if it does not exist yet. The token is only read from the environment
# and never written to disk or to git history.
set -euo pipefail

: "${HF_TOKEN:?Set HF_TOKEN to a Hugging Face token with write access}"
: "${HF_SPACE:?Set HF_SPACE to <user-or-org>/<space-name>, e.g. annaserrag/get-your-clave}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building…"
npm ci --no-audit --no-fund
npm run build

echo "Making sure the Space exists…"
OWNER="${HF_SPACE%%/*}"; NAME="${HF_SPACE##*/}"
ORG_FIELD=""
WHOAMI="$(curl -fsS -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/whoami-v2 | sed -n 's/.*"name":"\([^"]*\)".*/\1/p' | head -1)"
if [ "$OWNER" != "$WHOAMI" ]; then ORG_FIELD="\"organization\":\"$OWNER\","; fi
curl -sS -o /dev/null -w "  create space: HTTP %{http_code} (409 = already exists)\n" \
  -X POST https://huggingface.co/api/repos/create \
  -H "Authorization: Bearer $HF_TOKEN" -H "Content-Type: application/json" \
  -d "{\"type\":\"space\",${ORG_FIELD}\"name\":\"$NAME\",\"sdk\":\"static\",\"private\":false}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -R dist/. "$WORK/"
cat > "$WORK/README.md" <<'MD'
---
title: Get your Cl@ve
emoji: 🪪
colorFrom: yellow
colorTo: gray
sdk: static
app_file: index.html
pinned: false
short_description: Academic prototype of IE University (Group 10)
---

# Get your Cl@ve

Academic prototype of IE University (Connected Industries, Smart Cities & E-Government, Group 10).
It is not an official Government of Spain service and is not connected to the real Cl@ve system.
All people, documents and numbers are fictional. What is simulated is listed on the
"About this platform" page inside the app.

Source code: https://github.com/annaserrag/connected-industries-demo
MD

cd "$WORK"
git init -q -b main
git -c user.name="deploy" -c user.email="deploy@localhost" add -A
git -c user.name="deploy" -c user.email="deploy@localhost" commit -q -m "Deploy $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo build)"
# Token passed through a one-off credential header, so it never lands in .git/config.
git -c http.extraHeader="Authorization: Bearer $HF_TOKEN" push -q --force "https://huggingface.co/spaces/$HF_SPACE" main

echo "Done: https://huggingface.co/spaces/$HF_SPACE"
echo "Direct link (best for two windows side by side): https://${OWNER,,}-${NAME,,}.hf.space"
