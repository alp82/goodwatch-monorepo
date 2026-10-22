#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
: "${RELEASE_OUTPUT:?Choose a new absolute output directory}"
: "${IMAGE_PREFIX:=yepwatch}"
[[ "$RELEASE_OUTPUT" = /* ]] || { echo 'RELEASE_OUTPUT must be absolute' >&2; exit 1; }
[[ ! -e "$RELEASE_OUTPUT" ]] || { echo 'Refusing to overwrite release output' >&2; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo 'Commit tracked source changes before building' >&2; exit 1; }
commit=$(git rev-parse HEAD)
mkdir -p "$RELEASE_OUTPUT"
node goodwatch-webapp/app/server/yepwatch/build-release.mjs
(cd yepwatch-app && node scripts/release-env.cjs export --platform web --output-dir "$RELEASE_OUTPUT/web" --clear)
args=(--source "$root" --out "$RELEASE_OUTPUT/context" --web-export "$RELEASE_OUTPUT/web" --api-bundle "$root/goodwatch-webapp/build/yepwatch-release")
# Optional locally signed APK companion. CI never needs a signing key.
if [[ -n "${PREVIEW_DOWNLOAD:-}" ]]; then
  : "${PREVIEW_APK_FILENAME:?Versioned APK filename required}"
  args+=(--preview-download "$PREVIEW_DOWNLOAD" --preview-apk-filename "$PREVIEW_APK_FILENAME")
fi
node yepwatch-realtime/release/prepare-context.mjs "${args[@]}"
for service in api gateway front; do
  image="$IMAGE_PREFIX-$service:sha-$commit"
  dockerfile="$RELEASE_OUTPUT/context/$service/Dockerfile.$service"
  if [[ "$service" = gateway ]]; then dockerfile="$RELEASE_OUTPUT/context/gateway/yepwatch-realtime/release/Dockerfile.gateway"; fi
  docker build --platform linux/amd64 \
    --label "org.opencontainers.image.source=https://github.com/alp82/goodwatch-monorepo" \
    --label "org.opencontainers.image.revision=$commit" \
    -f "$dockerfile" -t "$image" "$RELEASE_OUTPUT/context/$service"
  printf '%s\n' "$image" > "$RELEASE_OUTPUT/$service.image"
done
docker image inspect "$(cat "$RELEASE_OUTPUT/api.image")" "$(cat "$RELEASE_OUTPUT/gateway.image")" "$(cat "$RELEASE_OUTPUT/front.image")" > "$RELEASE_OUTPUT/images.json"
printf 'Built commit %s. No deployment performed.\n' "$commit"
