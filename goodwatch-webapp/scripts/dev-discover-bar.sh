#!/usr/bin/env bash
# Development only: starts Vite with the Discover bar harness at http://127.0.0.1:${PORT:-3171}/dev/discover-bar and no
# production settings: `env -i`, every endpoint and key blank, and a preload that refuses outbound connections except
# loopback and goodwatch.app. The harness reads the live site's public endpoints as a guest through a dev server proxy
# (dev-discover-bar/vite.config.mjs). Refuses to start next to a .env file, which Remix would load.
set -euo pipefail
cd "$(dirname "$0")/.."
for file in .env .env.local .env.development .env.development.local; do
	[[ -e $file ]] && { echo "Refusing: $file is here and would be loaded. Use a worktree without it." >&2; exit 1; }
done
PORT="${PORT:-3171}"
exec env -i PATH="$PATH" HOME="$HOME" TERM=xterm NODE_ENV=development POSTHOG_DISABLED=1 \
	CRATE_HOSTS=127.0.0.1 CRATE_PORT=1 REDIS_HOST=127.0.0.1 REDIS_PORT=1 REDIS_HOST2= REDIS_HOST3= \
	TITLE_SNAPSHOT_REDIS_URL= TASTE_REDIS_URL= TITLE_CARDS_REDIS_URL= TITLE_FILTER_REDIS_URL= QDRANT_URL= \
	SUPABASE_URL= SUPABASE_ANON_KEY= POSTHOG_HOST= TMDB_API_KEY= TMDB_CONNECT_KEY= OPENROUTER_API_KEY= \
	TYPESAFE_API_KEY= POSTHOG_API_KEY= SEARCH_STORAGE_KEY= SENTRY_DSN= SENTRY_DISABLE_AUTO_UPLOAD=true \
	APP_ORIGIN="${APP_ORIGIN:-http://127.0.0.1:$PORT}" \
	NODE_OPTIONS="--import $PWD/scripts/dev-discover-bar/block-egress.mjs" \
	npx remix vite:dev --config scripts/dev-discover-bar/vite.config.mjs --host 127.0.0.1 --port "$PORT" --strictPort
