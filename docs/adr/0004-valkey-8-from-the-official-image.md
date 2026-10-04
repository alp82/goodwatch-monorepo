---
status: accepted
---

# Run the cache cluster on Valkey 8 from the official image

The three cache nodes run Valkey 8.1 from the official `valkey/valkey` image, pinned by tag and digest. It replaces
`docker.io/bitnami/redis-cluster:7.2` (Redis 7.2.4). Decided with the owner on October 4, 2026, together with
[ADR 0003](0003-redis-cluster-of-masters-with-volatile-lfu.md), whose topology and settings stay as they are.

The Bitnami image is gone from the registry. The hosts only had local copies, so a lost host or a new node could not
get the software. The image also ignored `REDIS_EXTRA_FLAGS` and ran Redis without a config file.

## Choices

- **Valkey 8.1, not Redis 8.** Valkey is the BSD-licensed continuation of Redis 7.2. It reads the Redis 7.2 data files
  and `nodes.conf` in place and speaks the same cluster bus, so each node changed software in one restart and kept its
  identity, slots, and data. Clients don't change: `ioredis` and `redis-py` connect as before.
- **The official image, pinned by tag and digest.** No vendor scripts sit between the container and the server.
  Nothing in the image creates or resets a cluster.
- **One config file for all nodes.** `goodwatch-cache/valkey.conf` holds every setting and is mounted read-only. The
  node's announce address and the password come from the host's `.env` file through the container's environment. A
  shell in the Compose command passes them to `valkey-server`, so the password is not in the repository, not in the
  config file, and not in the container's command.
- **User 1001, group 0.** The data volumes were written by the Bitnami image with that owner. Running Valkey as the
  same user needs no ownership change and keeps the way back open.

## Consequences

- Settings now come from a file under version control. A container restart keeps them. `CONFIG REWRITE` fails on
  purpose, because the mount is read-only: change the file and recreate the node.
- A new or rebuilt host can pull the image.
- The Compose directory, service, and environment variable names still say `redis`. They set the Compose project,
  container, and volume names, and the clients' variables, so they stay.
- An upgrade to another Valkey version is a change of the pinned tag and digest, applied one node at a time.
  [Private Redis](../private-redis.md) has the procedure and the way back.

Evidence: the resolution of the ticket "Replace the Bitnami Redis image with Valkey 8", which has the rehearsal
results and the memory comparison.
