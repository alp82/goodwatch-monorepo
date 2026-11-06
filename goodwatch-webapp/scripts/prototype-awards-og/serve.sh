#!/usr/bin/env bash
# PROTOTYPE: renders the /awards card variants, then serves the gallery on Tailscale HTTPS.
#   npm run prototype:awards-og   ->  https://<this machine>.ts.net:8621/
set -euo pipefail
cd "$(dirname "$0")/../.."
node_modules/.bin/vite-node scripts/prototype-awards-og/render.tsx
tailscale serve --bg --https=8621 http://127.0.0.1:3221 >/dev/null
echo "Gallery: https://$(tailscale status --json | jq -r .Self.DNSName | sed 's/\.$//'):8621/  (stop: Ctrl-C, then tailscale serve --https=8621 off)"
exec python3 -m http.server 3221 --bind 127.0.0.1 --directory prototype-awards-og-out
