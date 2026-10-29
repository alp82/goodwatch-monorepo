#!/usr/bin/env bash
# PROTOTYPE (TV easter eggs, 2026-10-29): starts the webapp with no production settings: env -i, blank endpoints and
# keys, and a preload that refuses non-loopback sockets. Titles come from app/ui/prototype-tv-eggs/titles.json.
# Vite 3176, behind `tailscale serve --bg --https=8576 http://127.0.0.1:3176`.
set -euo pipefail
cd "$(dirname "$0")"
[[ -e .env || -e ../.env ]] && { echo "Refusing: .env present" >&2; exit 1; }
mkdir -p "$HOME/.cache/start-lab/tmp"
exec env -i PATH="$PATH" HOME="$HOME" TERM=xterm NODE_ENV=development POSTHOG_DISABLED=1 \
  TMPDIR="$HOME/.cache/start-lab/tmp" \
  \
  CRATE_HOSTS=127.0.0.1 CRATE_PORT=1 REDIS_HOST=127.0.0.1 REDIS_PORT=1 REDIS_HOST2= REDIS_HOST3= \
  TITLE_SNAPSHOT_REDIS_URL= TASTE_REDIS_URL= TITLE_CARDS_REDIS_URL= TITLE_FILTER_REDIS_URL= QDRANT_URL= \
  SUPABASE_URL= SUPABASE_ANON_KEY= POSTHOG_HOST= TMDB_API_KEY= TMDB_CONNECT_KEY= OPENROUTER_API_KEY= \
  TYPESAFE_API_KEY= POSTHOG_API_KEY= SEARCH_STORAGE_KEY= SENTRY_DSN= \
  APP_ORIGIN="https://alppc.tail3b99f1.ts.net:8576" \
  __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=alppc.tail3b99f1.ts.net \
  NODE_OPTIONS="--import $HOME/.cache/start-lab/block-egress.mjs" \
  npx remix vite:dev --host 0.0.0.0 --port 3176 --strictPort
