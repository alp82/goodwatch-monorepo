#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../goodwatch-webapp"
containers=(gw-chatgpt-features-crate gw-chatgpt-features-valkey)
for c in "${containers[@]}"; do if docker inspect "$c" >/dev/null 2>&1; then echo "Refusing to reuse $c"; exit 1; fi; done
created=()
cleanup() { for c in "${created[@]}"; do docker rm -f -v "$c" >/dev/null 2>&1 || true; done; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --name "${containers[0]}" -p 127.0.0.1:15767:4200 -e CRATE_HEAP_SIZE=512m crate:5.10.16 -Cdiscovery.type=single-node -Ccluster.name=gw-mcp-567 -Cnetwork.host=0.0.0.0 >/dev/null
created+=("${containers[0]}")
docker run -d --name "${containers[1]}" -p 127.0.0.1:16767:6379 valkey/valkey:8.1.3 >/dev/null
created+=("${containers[1]}")
python - <<'PY'
import time,urllib.request
for _ in range(120):
 try:
  urllib.request.urlopen('http://127.0.0.1:15767',timeout=1);break
 except OSError:time.sleep(.5)
else:raise RuntimeError('Local CrateDB did not start')
PY
python scripts/mcp-features/seed-local.py
python scripts/mcp-features/scoped-grants.py
MCP_TEST_CRATE_USER=goodwatch_search MCP_TEST_CRATE_PASS=local-mcp-test-only node_modules/.bin/vite-node --config scripts/mcp-personal/vite.config.mjs scripts/mcp-features/local.integration.ts
