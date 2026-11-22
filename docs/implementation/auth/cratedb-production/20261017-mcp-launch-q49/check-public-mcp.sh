#!/usr/bin/env bash
set -euo pipefail
headers=$(mktemp)
trap 'rm -f "$headers"' EXIT
status=$(curl -sS --max-time 15 -D "$headers" -o /dev/null -X POST https://goodwatch.app/mcp -H 'Content-Type: application/json' --data '{}')
status=$(awk 'NR==1 {print $2}' "$headers")
printf 'HTTP status: %s\n' "$status"
if [[ "$status" != 401 ]]; then exit 1; fi
rg -i '^www-authenticate:.*resource_metadata="https://goodwatch.app/.well-known/oauth-protected-resource/mcp"' "$headers"
