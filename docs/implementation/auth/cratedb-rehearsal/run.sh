#!/usr/bin/env bash
# Disposable localhost-only rehearsal. Never accepts a remote Docker target.
set -euo pipefail
cd "$(dirname "$0")"
if [[ -S "/run/user/$(id -u)/docker.sock" ]]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/docker.sock"
else
  export DOCKER_HOST=unix:///var/run/docker.sock
fi
unset DOCKER_CONTEXT
export CRATE_IMAGE=crate:5.10.9@sha256:0ab5077b2cc4180a855250c8f0af425386197f7586af39a7b5d7a08c16558184
export LOCAL_HBA_ENABLED=false
compose=(docker --host "$DOCKER_HOST" compose -f "$PWD/compose.yaml" -p goodwatch-upgrade-547)
if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
  echo 'Refusing to reuse existing goodwatch-upgrade-547 containers.' >&2
  exit 1
fi
mkdir -p results
cleanup() {
  "${compose[@]}" unpause >/dev/null 2>&1 || true
  "${compose[@]}" logs --no-color > results/containers.log 2>&1 || true
  "${compose[@]}" down --volumes --remove-orphans
}
trap cleanup EXIT
python3 rehearse.py "$@"
