#!/usr/bin/env bash
# Isolated, loopback-only Discover/MCP rehearsal. No .env or production credentials.
set -euo pipefail
cd "$(dirname "$0")/../.."
crate=gw-mcp-search-discover-crate
valkey=gw-mcp-search-discover-valkey
for container in "$crate" "$valkey"; do
 if docker inspect "$container" >/dev/null 2>&1; then
  echo "Refusing to reuse existing $container" >&2
  exit 1
 fi
done
created=()
cleanup() { for container in "${created[@]}"; do docker rm -f "$container" >/dev/null; done; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --name "$crate" -p 127.0.0.1:15867:4200 -e CRATE_HEAP_SIZE=512m crate:5.10.12 -Cdiscovery.type=single-node -Ccluster.name=gw-mcp-search-discover -Cnetwork.host=0.0.0.0 >/dev/null
created+=("$crate")
docker run -d --name "$valkey" -p 127.0.0.1:16867:6379 valkey/valkey:8.1.3 >/dev/null
created+=("$valkey")
python - <<'PY'
import json,time,urllib.request
for attempt in range(180):
 try:
  req=urllib.request.Request('http://127.0.0.1:15867/_sql',data=b'{"stmt":"SELECT name FROM sys.cluster"}',headers={'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=1) as response:
   if json.load(response)['rows']==[['gw-mcp-search-discover']]:break
 except Exception:pass
 time.sleep(1)
else:raise RuntimeError('Disposable CrateDB did not become ready')
PY
MCP_LOCAL_CRATE_PORT=15867 python scripts/mcp-read/seed-local.py
node_modules/.bin/vite-node --config scripts/mcp-personal/vite.config.mjs scripts/mcp-discover/local.integration.ts
