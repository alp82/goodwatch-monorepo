#!/usr/bin/env bash
# Run on abio. A rolling deployment may have two healthy containers briefly. Use the newest healthy image.
set -euo pipefail
container=$(docker ps --filter 'name=^gk4owk8-' --filter health=healthy --format '{{.ID}}' | sed -n '1p')
test -n "$container"
image=$(docker inspect --format '{{.Image}}' "$container")
# Pass only the data connections. Values never enter a command argument or a file on disk.
while IFS= read -r setting; do
  export "$setting"
done < <(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" |
  grep -E '^(CRATE_HOSTS|CRATE_PORT|CRATE_USER|CRATE_PASS|REDIS_HOST|REDIS_HOST2|REDIS_HOST3|REDIS_PASS|REDIS_PORT|TITLE_SNAPSHOT_REDIS_URL)=')
exec docker run --rm --name goodwatch-explore-hubs --network coolify \
  --cpus=1 --cpu-shares=128 --memory=2g --memory-swap=2g --pids-limit=96 \
  --user=node --read-only --tmpfs /tmp:rw,nosuid,nodev,size=16m --cap-drop=ALL --security-opt=no-new-privileges \
  -e AVAILABILITY_PRELOAD=off -e CRATE_HOSTS -e CRATE_PORT -e CRATE_USER -e CRATE_PASS \
  -e REDIS_HOST -e REDIS_HOST2 -e REDIS_HOST3 -e REDIS_PORT -e REDIS_PASS -e TITLE_SNAPSHOT_REDIS_URL \
  "$image" node ./build/server/prepare-hubs.js
