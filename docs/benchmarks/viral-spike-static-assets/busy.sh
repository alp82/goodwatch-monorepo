#!/bin/bash
# busy.sh: says what else runs on the measurement host, so that a run doesn't overlap another agent's load.
docker ps --format '{{.Names}} {{.Image}} {{.Status}}' | grep -v -E '^(gw-static-|windmill-|grafana-alloy|node-exporter)' || true
uptime
