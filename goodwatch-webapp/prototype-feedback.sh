#!/usr/bin/env bash
# PROTOTYPE - throwaway. Starts the user feedback prototype on Vite 3097 with no production settings: `env -i`, every
# endpoint and key blank, and a preload that refuses any outbound connection that isn't loopback.
# Open /prototype/feedback (data: app/ui/prototype-feedback/*.json). Expose with:
#   tailscale serve --bg --https=8497 http://127.0.0.1:3097
set -euo pipefail
cd "$(dirname "$0")"
[[ -e .env ]] && { echo "Refusing: .env present in this worktree" >&2; exit 1; }
exec env -i PATH="$PATH" HOME="$HOME" TERM=xterm NODE_ENV=development POSTHOG_DISABLED=1 \
  CRATE_HOSTS=127.0.0.1 CRATE_PORT=1 REDIS_HOST=127.0.0.1 REDIS_PORT=1 REDIS_HOST2= REDIS_HOST3= \
  TITLE_SNAPSHOT_REDIS_URL= TASTE_REDIS_URL= TITLE_CARDS_REDIS_URL= TITLE_FILTER_REDIS_URL= QDRANT_URL= \
  SUPABASE_URL= SUPABASE_ANON_KEY= POSTHOG_HOST= TMDB_API_KEY= TMDB_CONNECT_KEY= OPENROUTER_API_KEY= \
  TYPESAFE_API_KEY= POSTHOG_API_KEY= SEARCH_STORAGE_KEY= SENTRY_DSN= \
  FEEDBACK_DISCORD_WEBHOOK_URL= DISCORD_BOT_TOKEN= DISCORD_CLIENT_SECRET= AUTH_SMTP_USER= AUTH_SMTP_PASSWORD= \
  OMDB_API_KEY= REDIS_PASS= CRATE_USER= CRATE_PASS= QDRANT_API_KEY= TMDB_CONNECT_PREVIOUS_KEY= \
  BETTER_AUTH_URL= BETTER_AUTH_SECRET= AUTH_CRATEDB_ORIGINS= AUTH_CRATEDB_USERNAME= AUTH_CRATEDB_PASSWORD= \
  AUTH_CRATEDB_ENCRYPTION_SECRET= AUTH_CRATEDB_ENCRYPTION_KEYS= AUTH_GOOGLE_CLIENT_ID= AUTH_GOOGLE_CLIENT_SECRET= \
  FASTSTATS_SITE_KEY= MCP_RESOURCE_URL= \
  APP_ORIGIN=https://alppc.tail3b99f1.ts.net:8497 \
  NODE_OPTIONS="--import $PWD/app/ui/prototype-feedback/block-egress.mjs" \
  npx remix vite:dev --host 0.0.0.0 --port 3097 --strictPort
