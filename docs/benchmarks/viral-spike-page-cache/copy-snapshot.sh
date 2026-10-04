#!/bin/bash
# copy-snapshot.sh <image>: copies the title snapshot keys from the production cache cluster (read only: SCAN,
# GETBUFFER) into the measurement instance's Valkey, with the script of the render profile
# (../viral-spike-render-profile/copy-snapshot.mjs, copied to /opt/gw-pagecache/work).
docker run --rm -i --name gw-pagecache-copy --network gw-pagecache-net --env-file /opt/gw-pagecache/prod-redis.env \
  -e LOCAL_REDIS_HOST=172.31.247.10 --entrypoint node -w /app $1 --input-type=module - < /opt/gw-pagecache/work/copy-snapshot.mjs
