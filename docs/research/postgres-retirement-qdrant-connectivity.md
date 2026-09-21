# Qdrant publication connectivity research

Investigated 2026-09-10, read-only. No firewall, deployment or database changes.

## Finding and correction

The prior incident review attributed six gRPC publication failures to worker `06b3c66b44d9` on `10.0.0.20`. This research independently reproduced the network failure and narrowed its cause: **the local worker's request to the host-published Qdrant port follows host INPUT filtering; a blanket cross-bridge isolation explanation is incorrect.**

Live evidence at approximately 06:56 UTC, collected through SSH on `.20`:

- Docker 28.5.1; worker `windmill-default_worker-1` is `172.18.0.3` on `windmill_default`, bridge `br-5dfeed115e72`; `qdrant-main` is `172.20.0.2` on `main_default`.
- `ss -lntp` shows `docker-proxy` listening on `10.0.0.20:6333`, `6334`, `6335`.
- NAT `PREROUTING` sends local destinations into `DOCKER`. Its first rule returns traffic arriving on the Windmill bridge, **before** Qdrant's DNAT rules.
- `INPUT` policy is DROP. UFW allows Qdrant ports only from `10.0.0.0/24`; worker source `172.18.0.3` does not match. Established-connection allowances do not admit a new SYN. Remaining inspected UFW chains do not supply an allowance.
- A headers-only tcpdump during a three-second connection probe captured SYN and retransmissions from `172.18.0.3:43462` to `10.0.0.20:6334` entering the Windmill bridge; the probe timed out. No firewall tracing rules were installed. Kernel logging yielded no matching line, so we do not claim a per-packet logged DROP.
- The same default-worker container on `.11` successfully connected to both `.20:6333` and `.20:6334`.

The rules plus capture establish a strong, specific explanation: early NAT return leaves a host destination; host INPUT drops the unallowed Docker source before the listening proxy can accept it. A reversible narrow allowance and successful repeat probe should be the final causal test during implementation. Direct use of Qdrant's container IP would instead encounter forwarding/bridge policy; that is a different path. Docker explicitly documents published ports as the normal cross-network access mechanism ([bridge documentation](https://docs.docker.com/engine/network/drivers/bridge/), [port publishing](https://docs.docker.com/engine/network/port-publishing/)).

Reproduction sources: SSH `docker inspect --format '{{json .NetworkSettings.Networks}}' ...`; `iptables -t nat -S DOCKER`; `iptables -t nat -S PREROUTING`; `iptables -S INPUT`; `iptables -S ufw-user-input`; remaining INPUT-linked UFW chains; `ss -lntp`; `docker exec windmill-default_worker-1 python3 -c 'import socket; socket.create_connection(("10.0.0.20",6334),3)'`. Capture filter: `src host 172.18.0.3 and dst port 6334 and tcp[tcpflags] & tcp-syn != 0`. These are dated live primary observations, not a claim that network addresses will remain static.

## Recommended fix and alternatives

Use a persistent, managed **UFW INPUT allowance** restricted to the Windmill bridge/subnet, destination `10.0.0.20`, TCP ports `6333,6334`. Resolve/pin bridge identity and subnet in the owning deployment configuration, or reconcile rules on network recreation; a hand-written rule referencing today's dynamic container IP is insufficient. This retains the existing endpoint for every worker and avoids touching Docker-managed isolation chains. UFW supports interface, source, destination and port restrictions and distinguishes host INPUT from `route`/FORWARD rules ([official Ubuntu UFW manual](https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html)). Confirm host proxy OUTPUT/return traffic in the implementation test. Port 6335 is outside this client ticket.

Alternative: a dedicated Compose network joining only Qdrant and the local workers, with durable local endpoint/DNS selection. This changes service topology and creates host-specific endpoint handling; merely attaching another network does not redirect the current hard-coded host address. Shared network members gain direct port reachability, so it is broader than the proposed two-port allowance ([Compose networking](https://docs.docker.com/compose/how-tos/networking/)). Avoid host networking or globally disabling isolation for this narrow defect.

## Client resilience correction

[`f/db/qdrant.py`](../../goodwatch-flows/windmill/f/db/qdrant.py) sets `timeout=None`, enables gRPC retry machinery and reconnect backoff. **None is not an infinite gRPC deadline in pinned client 1.15.1:** that version assigns `DEFAULT_GRPC_TIMEOUT = 5`, and upsert uses the configured default ([versioned client source](https://github.com/qdrant/qdrant-client/blob/v1.15.1/qdrant_client/qdrant_remote.py)). Set an explicit reviewed deadline to make the budget visible; do not describe this as fixing an unbounded call without measuring the full operation path.

[`vector_data.py`](../../goodwatch-flows/windmill/f/sync/copy/vector_data.py) uses direct `qc.client.upsert(..., wait=True)` for strict priority writes; the connector's bulk `upload_collection(max_retries=2)` is bypassed there. Channel reconnect settings alone are not a complete application retry policy ([gRPC retry guide](https://grpc.io/docs/guides/retry/)). Add bounded backoff/jitter for selected transient errors, with one overall publication budget. Keep invalid data/authentication errors immediate, keep completion-status checking, and never acknowledge an unsuccessful publication. Retrying the same deterministic point IDs is consistent with Qdrant's idempotent upsert behavior ([Qdrant points documentation](https://qdrant.tech/documentation/manage-data/points/)); serialize/protect against replaying stale payloads over newer writes.

## Proposed ticket

**Restore local-worker Qdrant connectivity and bound strict publication retries.**

Acceptance:

1. Reproduce the failure before the scoped rule, then prove both REST and authenticated gRPC collection/read operations from **both local worker containers on `.20` and every other eligible worker**. TCP success alone does not validate credentials, RPC deadlines or upserts.
2. Verify persistent behavior after worker recreation and firewall reload; verify public exposure and unrelated bridge access did not expand. Record the owning config, exact rollback and network-ID reconciliation.
3. Test transient unavailable/deadline failures, permanent errors and exhausted retry budget. Retry only deterministic writes; preserve strict COMPLETED requirement and queue lease/ack semantics.
4. Replay an affected title on `.20`, verify Crate/Qdrant contents and acknowledgment; observe normal scheduled writes across workers afterward. No direct live writes were performed during this research.

Decision for the combined interview: accept the minimal managed UFW allowance (recommended), or choose the larger dedicated-network change? Deadline/backoff numbers are routine implementation choices informed by measured latency unless a publication latency SLO is required. No separate Postgres retirement dependency was found here.
