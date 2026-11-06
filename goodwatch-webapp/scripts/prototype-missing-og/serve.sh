#!/usr/bin/env bash
# PROTOTYPE: renders the missing link-preview card variants, then serves the gallery on Tailscale HTTPS.
#   npm run prototype:missing-og   ->  https://<this machine>.ts.net:8622/
set -euo pipefail
cd "$(dirname "$0")/../.."
node_modules/.bin/vite-node scripts/prototype-missing-og/render.tsx
tailscale serve --bg --https=8622 http://127.0.0.1:3222 >/dev/null
echo "Gallery: https://$(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//'):8622/  (stop: Ctrl-C, then tailscale serve --https=8622 off)"
exec python3 -m http.server 3222 --bind 127.0.0.1 --directory prototype-missing-og-out
