#!/usr/bin/env bash
# PROTOTYPE - throwaway. Starts the Discover mood prototype on Vite 3163 with no production settings: `env -i`, every
# endpoint and key blank, and a preload that refuses outbound connections except loopback and goodwatch.app.
# Open /prototype/discover-mood (data comes from the live site through /prototype/discover-mood/proxy/, as a guest).
set -euo pipefail
cd "$(dirname "$0")"
[[ -e .env ]] && { echo "Refusing: .env present in this worktree" >&2; exit 1; }
exec env -i PATH="$PATH" HOME="$HOME" TERM=xterm NODE_ENV=development POSTHOG_DISABLED=1 \
  CRATE_HOSTS=127.0.0.1 CRATE_PORT=1 REDIS_HOST=127.0.0.1 REDIS_PORT=1 REDIS_HOST2= REDIS_HOST3= \
  TITLE_SNAPSHOT_REDIS_URL= TASTE_REDIS_URL= TITLE_CARDS_REDIS_URL= TITLE_FILTER_REDIS_URL= QDRANT_URL= \
  SUPABASE_URL= SUPABASE_ANON_KEY= POSTHOG_HOST= TMDB_API_KEY= TMDB_CONNECT_KEY= OPENROUTER_API_KEY= \
  TYPESAFE_API_KEY= POSTHOG_API_KEY= SEARCH_STORAGE_KEY= SENTRY_DSN= \
  APP_ORIGIN=https://alppc.tail3b99f1.ts.net:8563 \
  NODE_OPTIONS="--import $PWD/app/ui/prototype-discover-mood/block-egress.mjs" \
  npx remix vite:dev --host 0.0.0.0 --port 3163 --strictPort
