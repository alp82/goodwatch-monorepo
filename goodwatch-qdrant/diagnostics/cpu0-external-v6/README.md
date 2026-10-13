# Prepared CPU0 external diagnostic packet

This source prepares one isolated clone comparison for [map #100](https://github.com/alp82/goodwatch-monorepo/issues/100). It is not an executed experiment or a production rollout. Final source hashes, packet bindings and review results must come from the completed immutable packet; this README does not establish readiness.

The packet authenticates the unchanged fourteen-file backend source closure from [#500](https://github.com/alp82/goodwatch-monorepo/pull/500), the reviewed CPU0 consumer successor from [#501](https://github.com/alp82/goodwatch-monorepo/pull/501), the exact retained `f831…` preparation helper, both policies and every declared external dependency before execution. The helper is injected through reviewed versioned entrypoints, not invoked as a standalone CLI. Original V1–V5 packets, store and archive remain intact.

## Local reproduction

From this directory, run the local fixtures. They use temporary files, processes, sockets and fake boundaries; they do not authorize host execution.

```sh
/usr/bin/python3 -B -m unittest discover -s . -p 'test_*.py'
/usr/bin/python3 -I -B build_packet.py
/usr/bin/python3 -I -B local_entry.py
```

The last two commands return `prepared-only`. Constructing a packet is a separate local action; use reviewed public files and fresh output filenames in a private local directory. The prior-policy input contains exact V1–V5 source and registered-writer bounds, not credentials or private queries.

```sh
/usr/bin/python3 -I -B build_packet.py \
  --prepare-reviewed-public-packet \
  --source-dir '<frozen-backend-directory>' \
  --consumer-dir '<frozen-consumer-directory>' \
  --reclaim-helper '<exact-retained-f831-helper>' \
  --external-dir '<frozen-external-directory>' \
  --prior-policy '<reviewed-public-prior-policy.json>' \
  --output '<fresh-public-packet.json>' \
  --local-execution-closure '<fresh-local-closure.json>'
```

This writes two local files with `O_EXCL`, mode `0600` and fsync, and reports their hashes. It performs no host operations. Preserve the exact emitted bytes and hashes. Preparation does not validate that a live source currently satisfies admission.

After the exact complete source and transport have passed root's review and actual Claude Code Opus 5.5 medium source review, root alone supplies the frozen values and runs the following entry. This is an execution recipe with placeholders, not a host default or a request for another owner approval.

```sh
/usr/bin/python3 -I -B local_entry.py \
  --execute-reviewed \
  --execution-closure '<fresh-local-closure.json>' \
  --execution-closure-sha256 '<reviewed-closure-sha256>' \
  --packet '<fresh-public-packet.json>' \
  --packet-sha256 '<reviewed-packet-sha256>' \
  --contract-dir '<frozen-public-consumer-contract-directory>' \
  --validator '<frozen-validate_admission.mjs>' \
  --outer-sha256 '<reviewed-outer_local.py-sha256>' \
  --raise-own-nofile
```

`local_entry.py` authenticates its complete local closure before importing it. The stdin bootstrap authenticates the complete remote closure before importing it; backend imports additionally require the exact fourteen-file source freeze. No undeclared checkout module or caller-selected target substitutes for these bindings.

## Protocol and fixed scope

1. On clone host `10.0.0.32`, setup authenticates and gracefully stops only the old owned `gw-qdrant-cold-406-20261011`, preserving it intact. It creates `gw-qdrant-cpu0-100-20261012` with the pinned image, exact configured non-CPU parity and mounts, 6 GiB memory/swap, loopback `127.0.0.1:16333`, restart disabled and CPU quota removed. A fresh writable image layer is an explicit non-parity; the shared writable store is not a pristine rollback snapshot.
2. Separately owned setup, preflight, staging, zero-pin turnover and outer admission phases authenticate the predecessor handoff and renew shape, birth, CPU hierarchy and host admission. Each holds the same control lock only for its phase. No conflicting second lock is retained across an ownership handoff.
The OLD-only graceful shutdown admission requires more than 2 GiB available memory. This is a declared engineering margin for bounded inspection and release, not a kernel capacity guarantee or comparison admission. It retains CPU, swap, disk, allocation, source and lifecycle checks. NEW creation/start and every CPU0 runtime admission continue to require more than 5 GiB. An uncertain stop remains terminal; no automatic restart, retry or capture follows. See [the focused amendment](SHUTDOWN-ADMISSION.md) for provenance and fixture limits.

3. The authenticated consumer commits its own admission handoff. Outer registration independently verifies its exact PID/birth and reviewed argv before permitting producer capture.
4. On `10.0.0.21`, the producer authenticates the retained source, both preload guards, credential receipt and exact five-key private environment before creation. Credentials stay out of argv and public output. Engine receives them in its request body and persists container `Env` configuration until removal; this existing persistence is not a RAM-only guarantee. The legacy image, 3 GiB memory/swap, 2 CPU limit, read-only root, two read-only mounts, bounded tmpfs/pids and `none` log driver remain fixed. No model download or provider request is introduced.
5. Public producer creation and running-registration receipts are persisted before their corresponding exposure. The pipe demultiplexes registration and exit control frames, confirms the running birth independently and forwards only private packets into consumer memory. Private bytes do not enter journals, stderr, files or the public ledger.
6. The native control runs first. The fixed nine slots permit at most nine baseline/candidate pairs and eighteen preparation writers. A refusal ends the packet; there is no automatic retry or resumption. Direct HTTP uses `Connection: close`, with socket closure before query acknowledgement. The consumer requires complete phase evidence, observed controller exit and the successor handoff before continuing.
7. Final independent cleanup runs on both sites even after refusal. It uses immutable code, public receipts, current birth/shape fences and registered-writer census. Producer cleanup does not depend on credentials still existing.

## Bounds and evidence limits

The original operation deadline is 7,200 seconds, propagated to RPC and streaming. The remote producer receives only the remaining lease; it cannot start a fresh 7,200-second budget. Ordinary RPC and consumer readiness have a 1,200-second bound; independent final cleanup has up to 60 seconds per site afterward. Direct local transport-client cleanup uses TERM/10 seconds then KILL/5 seconds. These are userspace bounds, not guarantees against uninterruptible kernel or daemon IO.

Frozen backend limits include a shared 20-second clone child-stop budget, up to 2 additional seconds for its own inspect-client cleanup, 180-second archive pressure and initial pin request, 30-second steady pin request, 10-second reconciliation and 60-second query lease. Direct HTTP has a 30-second timeout. The helper's unchanged writer/quiescence bounds remain in the authenticated policy; none is extended to make a result pass.

The pipe bounds private buffering to 2 MiB, each public line to 262,144 bytes and public output to 16 MiB. Public packet input is at most 8 MiB. Source and receipt readers retain their own fixed bounds.

Producer completion requires actual attached Docker CLI exit `0`, independently observed Engine container exit `0`, private-stream completion and registered birth disappearance before the completion marker. SSH exit or `--rm` absence cannot substitute. The [tagged Moby v27.0.3 wait route](https://raw.githubusercontent.com/moby/moby/v27.0.3/api/server/router/container/container_routes.go) installs the waiter before flushing successful headers, providing protocol context for the headers-before-start fence. This is not attestation of the actual abio daemon version; unsupported behavior refuses.

A missing registration, replaced birth, incomplete census, timeout, nonzero stop or cleanup uncertainty stays terminal and unknown. No missing receipt implies absence; no late exit upgrades an earlier refusal. Evidence proves only the registered instances actually checked. Universal absence of unknown early children remains unproven. Clone child SIGTERM is narrowly bound to the reviewed actual wrapper/child identities; there is no Qdrant SIGKILL fallback or automatic restart after an uncertain stop. KILL of an owned transport client is a different action. The supported producer command is `docker start --attach <exact-created-container-ID>`. Its non-TTY attach forwards signals, so TERM of this direct client may also reach the exact owned producer container; this cleanup is not local-only. It does not signal a clone or production Qdrant. Container cleanup still requires its independently verified registered birth, and any nonzero exit remains a refusal. The [tagged Docker CLI start implementation](https://github.com/docker/cli/blob/v27.0.3/cli/command/container/start.go) attaches and installs its wait before starting, and registers no `--sig-proxy` option; the [start reference](https://docs.docker.com/reference/cli/docker/container/start/) documents signal forwarding. These primary sources describe the supported protocol, not the actual abio CLI version.

This packet introduces no ordinary application searches, history writes, Jev calls, production mutation or model downloads. Cached private reconstruction can perform the existing read-only SQL reads. A successful clone comparison would still not establish application first-usable latency, production headroom, seven-day error-free coverage or map #100 acceptance.
