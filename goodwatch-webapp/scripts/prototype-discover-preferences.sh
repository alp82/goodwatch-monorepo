#!/usr/bin/env bash
# PROTOTYPE - throwaway (discover search preferences, 2026-11-04). Starts the real /discover page in an isolated dev
# server at http://127.0.0.1:${PORT:-5220}/discover?q=Historical+Action&variant=A with no production settings: `env -i`,
# every database endpoint and key blank, background jobs pointed at closed loopback ports, and the egress preload of
# dev-discover-bar.sh. The browser's reads go through prototype-discover-preferences/vite.config.mjs: guest reads of
# goodwatch.app's Discover results (no cookies) and the local read-only V7 preview service on 127.0.0.1:5219.
# Refuses to start next to a .env file, which Remix would load.
set -euo pipefail
cd "$(dirname "$0")/.."
for file in .env .env.local .env.development .env.development.local; do
	[[ -e $file ]] && { echo "Refusing: $file is here and would be loaded. Use a worktree without it." >&2; exit 1; }
done
PORT="${PORT:-5220}"
exec env -i PATH="$PATH" HOME="$HOME" TERM=xterm NODE_ENV=development POSTHOG_DISABLED=1 \
	GW_PROTOTYPE_DISCOVER_PREFERENCES=1 V7_PREVIEW_URL="${V7_PREVIEW_URL:-http://127.0.0.1:5219}" \
	CRATE_HOSTS=127.0.0.1 CRATE_PORT=1 REDIS_HOST=127.0.0.1 REDIS_PORT=1 REDIS_HOST2= REDIS_HOST3= \
	TITLE_SNAPSHOT_REDIS_URL= TASTE_REDIS_URL= TITLE_CARDS_REDIS_URL= TITLE_FILTER_REDIS_URL= QDRANT_URL= \
	DATABASE_URL= POSTGRES_URL= PGHOST=127.0.0.1 PGPORT=1 \
	SUPABASE_URL= SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= POSTHOG_HOST= TMDB_API_KEY= TMDB_CONNECT_KEY= \
	OPENROUTER_API_KEY= TYPESAFE_API_KEY= POSTHOG_API_KEY= SEARCH_STORAGE_KEY= SENTRY_DSN= SENTRY_DISABLE_AUTO_UPLOAD=true \
	APP_ORIGIN="http://127.0.0.1:$PORT" \
	NODE_OPTIONS="--import $PWD/scripts/dev-discover-bar/block-egress.mjs" \
	npx remix vite:dev --config scripts/prototype-discover-preferences/vite.config.mjs --host 127.0.0.1 --port "$PORT" --strictPort
