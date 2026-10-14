#!/usr/bin/env bash
# Only operates on this disposable local Compose project, never a remote daemon.
set -euo pipefail
cd "$(dirname "$0")"
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
  export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
export COMPOSE_PROJECT_NAME=goodwatch-cas-530
compose=(docker compose -f "$PWD/compose.yaml" -p "$COMPOSE_PROJECT_NAME")
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
  echo 'Refusing to reuse existing goodwatch-cas-530 containers.' >&2
  exit 1
fi
cleanup() {
  "${compose[@]}" unpause >/dev/null 2>&1 || true
  "${compose[@]}" logs --no-color > "${CRATE_PROOF_OUTPUT:-$PWD/results}/containers.log" 2>&1 || true
  "${compose[@]}" down --volumes --remove-orphans
}
mkdir -p "${CRATE_PROOF_OUTPUT:-$PWD/results}"
trap cleanup EXIT
"${compose[@]}" up -d
node verify.mjs "${CRATE_PROOF_OUTPUT:-$PWD/results}/observations.json"
