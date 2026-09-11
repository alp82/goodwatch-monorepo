#!/bin/sh
set -eu
exec /usr/bin/python3 /usr/local/lib/goodwatch-worker-firewall/reconcile.py \
  --config /etc/goodwatch-worker-firewall.json --apply \
  --snapshot "/var/lib/goodwatch-worker-firewall/rollback-$(date -u +%Y%m%dT%H%M%S)-$$.json"
