#!/usr/bin/env bash
# Owns only the disposable local goodwatch-client-588 Docker Compose project.
set -euo pipefail
cd "$(dirname "$0")"
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
  export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
compose=(docker compose -f "$PWD/compose.yaml" -p goodwatch-client-588)
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
  echo 'Refusing to reuse existing goodwatch-client-588 containers.' >&2
  exit 1
fi
output="${CRATE_PROOF_OUTPUT:-$PWD/results/observations.json}"
mkdir -p "$(dirname "$output")"
cleanup() {
  "${compose[@]}" logs --no-color > "$(dirname "$output")/containers.log" 2>&1 || true
  "${compose[@]}" down --volumes --remove-orphans
  rm -f baseline-crate.ts backend-timeout.ts
  if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
    echo 'Cleanup failed: owned containers still exist.' >&2
    return 1
  fi
}
trap cleanup EXIT
if [[ "${CRATE_PROOF_BASELINE:-0}" == 1 ]]; then
  baseline_commit=$(git merge-base origin/main HEAD)
  git show "$baseline_commit:goodwatch-webapp/app/utils/crate.ts" > baseline-crate.ts
  git show "$baseline_commit:goodwatch-webapp/app/utils/backend-timeout.ts" > backend-timeout.ts
fi
"${compose[@]}" up -d
node verify.mjs "$output"
