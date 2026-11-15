#!/usr/bin/env bash
# PROTOTYPE: renders the /stats card variants, then serves the gallery on Tailscale HTTPS.
#   npm run prototype:stats-og   ->  https://<this machine>.ts.net:8624/
set -euo pipefail
cd "$(dirname "$0")/../.."
node_modules/.bin/vite-node scripts/prototype-stats-og/render.tsx
tailscale serve --bg --https=8624 http://127.0.0.1:3224 >/dev/null
echo "Gallery: https://$(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//'):8624/  (stop: Ctrl-C, then tailscale serve --https=8624 off)"
exec python3 -m http.server 3224 --bind 127.0.0.1 --directory prototype-stats-og-out
