#!/usr/bin/env bash
# Removes what lab.py creates, for a run that could not clean up after itself. Touches only hba-* objects.
set -u
for n in 1 2 3; do docker rm -f -v "hba-crate-$n" >/dev/null 2>&1; done
docker rm -f hba-chown >/dev/null 2>&1
docker network rm hba-net >/dev/null 2>&1
for v in hba-crate-1-data hba-crate-2-data hba-crate-3-data hba-snapshots; do docker volume rm "$v" >/dev/null 2>&1; done
echo "containers: $(docker ps -a --filter name=hba- --format '{{.Names}}' | tr '\n' ' ')"
echo "networks: $(docker network ls --filter name=hba- --format '{{.Name}}' | tr '\n' ' ')"
echo "volumes: $(docker volume ls --filter name=hba- --format '{{.Name}}' | tr '\n' ' ')"
