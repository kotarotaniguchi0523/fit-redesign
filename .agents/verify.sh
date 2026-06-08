#!/usr/bin/env bash
# UI検証ヘルパー: 永続稼働中の dev server (localhost:4321) に対して
# agent-browser で desktop / mobile のスクリーンショットを撮る。
#
# 前提: `pnpm dev` 相当が localhost:4321 で稼働していること（このセッションでは background task で常駐）。
#
# 使い方:
#   bash .agents/verify.sh <slug> <path> [<slug2> <path2> ...]
# 例:
#   bash .agents/verify.sh home "/" unit "/unit-base-conversion/2013"
#
# 出力: screenshots/verify/<slug>-desktop.png と -mobile.png

set -uo pipefail
cd "$(dirname "$0")/.."

unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
export NO_PROXY="localhost,127.0.0.1" no_proxy="localhost,127.0.0.1"
export PATH="/home/kotaro/.nvm/versions/node/v24.13.0/bin:$PATH"
export XDG_RUNTIME_DIR="$TMPDIR/ab-runtime"
mkdir -p "$XDG_RUNTIME_DIR"

PORT="${PORT:-4321}"
BASE="http://localhost:$PORT"
OUTDIR="screenshots/verify"
mkdir -p "$OUTDIR"

# 起動確認
code=$(curl -s --noproxy '*' -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null)
if [ "$code" != "200" ]; then
  echo "DEV SERVER NOT REACHABLE at $BASE (code=$code). Start it first."
  exit 1
fi

while [ $# -gt 0 ]; do
  slug="$1"; path="$2"; shift 2
  url="$BASE$path"

  agent-browser set viewport 1280 900 >/dev/null 2>&1
  agent-browser open "$url" >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  agent-browser screenshot --full "$OUTDIR/${slug}-desktop.png" >/dev/null 2>&1 \
    && echo "shot: ${slug}-desktop.png" || echo "FAIL desktop $path"

  agent-browser set viewport 390 844 >/dev/null 2>&1
  agent-browser open "$url" >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  agent-browser screenshot --full "$OUTDIR/${slug}-mobile.png" >/dev/null 2>&1 \
    && echo "shot: ${slug}-mobile.png" || echo "FAIL mobile $path"
done

echo "ALL DONE"
