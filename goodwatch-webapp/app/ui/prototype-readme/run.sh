#!/usr/bin/env bash
# PROTOTYPE (README pictures): starts this worktree's webapp with no production settings (env -i, blank endpoints and
# keys, a preload that refuses non-loopback sockets). Scenes: http://127.0.0.1:3177/prototype/readme/<name>
set -euo pipefail
cd "$(dirname "$0")/../../.."
[[ -e .env || -e ../.env ]] && { echo "Refusing: .env present" >&2; exit 1; }
mkdir -p "$HOME/.cache/readme-proto/tmp"
exec env -i PATH="$PATH" HOME="$HOME" TERM=xterm NODE_ENV=development POSTHOG_DISABLED=1 \
  TMPDIR="$HOME/.cache/readme-proto/tmp" \
  CRATE_HOSTS=127.0.0.1 CRATE_PORT=1 REDIS_HOST=127.0.0.1 REDIS_PORT=1 REDIS_HOST2= REDIS_HOST3= \
  TITLE_SNAPSHOT_REDIS_URL= TASTE_REDIS_URL= TITLE_CARDS_REDIS_URL= TITLE_FILTER_REDIS_URL= QDRANT_URL= \
  SUPABASE_URL= SUPABASE_ANON_KEY= POSTHOG_HOST= TMDB_API_KEY= TMDB_CONNECT_KEY= OPENROUTER_API_KEY= \
  TYPESAFE_API_KEY= POSTHOG_API_KEY= SEARCH_STORAGE_KEY= SENTRY_DSN= \
  APP_ORIGIN="http://127.0.0.1:3177" \
  NODE_OPTIONS="--import /home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/bench2/block-egress.mjs" \
  npx remix vite:dev --host 127.0.0.1 --port 3177 --strictPort
