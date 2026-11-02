#!/usr/bin/env bash
# PROTOTYPE: renders the /discover card designs, then serves the gallery on Tailscale HTTPS.
#   npm run prototype:discover-og  ->  https://alppc.tail3b99f1.ts.net:8501/
set -euo pipefail
cd "$(dirname "$0")/../.."
node_modules/.bin/vite-node scripts/prototype-discover-og/render.tsx
tailscale serve --bg --https=8501 http://127.0.0.1:3107 >/dev/null
echo "Gallery: https://alppc.tail3b99f1.ts.net:8501/  (stop: Ctrl-C, then tailscale serve --https=8501 off)"
exec python3 -m http.server 3107 --bind 127.0.0.1 --directory prototype-discover-og-out
