#!/usr/bin/env bash
# PROTOTYPE: renders the yepwatch.com link-preview card variants, then serves the gallery on Tailscale HTTPS.
#   npm run prototype:yepwatch-og   ->  https://<this machine>.ts.net:8623/
set -euo pipefail
cd "$(dirname "$0")/../.."
node_modules/.bin/vite-node --config scripts/prototype-yepwatch-og/vite.config.ts scripts/prototype-yepwatch-og/render.tsx
tailscale serve --bg --https=8623 http://127.0.0.1:3223 >/dev/null
echo "Gallery: https://$(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//'):8623/  (stop: Ctrl-C, then tailscale serve --https=8623 off)"
exec python3 -m http.server 3223 --bind 127.0.0.1 --directory prototype-yepwatch-og-out
