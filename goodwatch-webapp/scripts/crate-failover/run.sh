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
  rm -f baseline-crate.ts backend-timeout.ts crate-diagnostics.ts page-loaders.generated.mjs
  if [[ -n "$("${compose[@]}" ps -aq)" ]]; then
    echo 'Cleanup failed: owned containers still exist.' >&2
    return 1
  fi
  for resource in volume network; do
    if [[ -n "$(docker "$resource" ls -q --filter label=com.docker.compose.project=goodwatch-client-588)" ]]; then
      echo "Cleanup failed: owned $resource resources still exist." >&2
      return 1
    fi
  done
  node - "$output" <<'JS'
const fs = require('node:fs');
fs.writeFileSync(process.argv[2].replace(/\.json$/, '-cleanup.json'), JSON.stringify({
  verifiedAt: new Date().toISOString(), project: 'goodwatch-client-588',
  containersRemaining: 0, volumesRemaining: 0, networksRemaining: 0,
}, null, 2) + '\n');
JS
}
trap cleanup EXIT
if [[ "${CRATE_PROOF_BASELINE:-0}" == 1 ]]; then
  baseline_commit=${CRATE_PROOF_BASELINE_COMMIT:-$(git merge-base origin/main HEAD)}
  export CRATE_PROOF_BASELINE_COMMIT=$(git rev-parse "$baseline_commit")
  git show "$baseline_commit:goodwatch-webapp/app/utils/crate.ts" > baseline-crate.ts
  git show "$baseline_commit:goodwatch-webapp/app/utils/backend-timeout.ts" > backend-timeout.ts
  # Preserve the baseline's source and share the HTTP request context with its diagnostics import.
  echo 'export * from "../../app/utils/crate-diagnostics.ts"' > crate-diagnostics.ts
fi
if [[ "${CRATE_PROOF_PAGES:-0}" == 1 ]]; then
  node build-page-proof.mjs
fi
"${compose[@]}" up -d
node verify.mjs "$output"
