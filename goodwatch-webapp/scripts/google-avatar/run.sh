#!/usr/bin/env bash
# Real Crate visibility and concurrent writes matter for the provider-avatar request path.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="gw-provider-avatar-test-$$"
trap 'docker stop "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --rm --name "$container" -p 127.0.0.1::4200 -e CRATE_HEAP_SIZE=384m crate:5.10.16 \
  -Cdiscovery.type=single-node -Ccluster.name=avatar-regression-isolated -Cnetwork.host=0.0.0.0 >/dev/null
port=$(docker port "$container" 4200/tcp)
env -i PATH="$PATH" PYTHONPATH=../goodwatch-flows/windmill python3 scripts/google-avatar/schema.py "${port##*:}"
env -i PATH="$PATH" NODE_ENV=production AVAILABILITY_PRELOAD=off CRATE_HOSTS=127.0.0.1 \
  CRATE_PORT="${port##*:}" node scripts/google-avatar/verify.mjs
