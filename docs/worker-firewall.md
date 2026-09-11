# Durable local worker firewall access

The worker deployment owns five host INPUT permissions: local Windmill workers to Crate HTTP on `10.0.0.11–13:4200`, and to Qdrant REST/gRPC on `10.0.0.20:6333/6334`. Remote private clients retain their existing rules. These are not forwarding permissions; no general inter-bridge access or extra database/cluster ports are introduced.

## Ownership and reconciliation

`goodwatch-remote/firewall/` contains the host reconciler, explicit host configurations, installer and systemd units. It matches the Docker network's exact name and Compose project/network labels, inspects its actual bridge interface and subnet, and permits only the configured private destination and required ports. The configured subnet allowlist covers the current `172.18.0.0/16` deployment and the repository's future `172.28.0.0/24` configuration. Only the subnet actually present is granted access. The pinned `br-windmill` option in the default Compose configuration remains supported; rollout does not require changing a running network's subnet.

Existing exact `Windmill to local Crate HTTP` / `Windmill to local Qdrant HTTP` / `Windmill to local Qdrant gRPC` rules are adopted without reapplying working permissions. Newly generated rules use the `gw-worker:` ownership prefix. Additions precede removal of obsolete owned rules, and the reconciler verifies persistent UFW configuration and active INPUT rules. Unrelated SSH, web, shared etcd, application, IPv6 and forwarding rules are preserved.

Network identity, driver or subnet mismatches and Docker inspection failures abort without firewall writes. A successfully observed missing network allows obsolete owned rules to be removed. Root-owned configuration prevents network labels alone from granting permission. Concurrent executions serialize through a local lock. The systemd service/timer reconciles 30 seconds after boot and every 30 seconds, covering Docker network recreation and firewall reload without replacing UFW or Docker's firewall chains.

## Rollout and verification

Install on one host at a time using that host's explicit configuration. Run the default dry-run plan first. Capture the existing UFW rules and network metadata in a protected root-owned directory. Apply only the reviewed plan and check a fresh SSH connection before continuing. Existing live additions are already functional; initial adoption should produce no rule changes.

On each target host, from the checked-out deployment directory (replace `11` with `12`, `13` or `20`):

```sh
sudo sh goodwatch-remote/firewall/install.sh goodwatch-remote/firewall/host-11.json
sudo systemctl start goodwatch-worker-firewall.service
sudo systemctl enable --now goodwatch-worker-firewall.timer
sudo systemctl status goodwatch-worker-firewall.timer --no-pager
```

`install.sh` installs artifacts and prints a plan; only the explicit service start applies it. For a manual plan, run `sudo python3 /usr/local/lib/goodwatch-worker-firewall/reconcile.py --config /etc/goodwatch-worker-firewall.json`. Mutation snapshots are saved under `/var/lib/goodwatch-worker-firewall/rollback-*.json`; unchanged periodic checks do not create snapshots. A recreation outside the controlled rollout can take up to one timer interval to reconcile; invoke the service synchronously before starting workers when immediate readiness is required.

For controlled recreation, inspect `windmill_default` and verify its members are only the owning `default_worker` and, on `.20`, `highperf_worker` containers. Save their IDs, images and network aliases, plus the network's labels, IPAM settings and options. Drain with `docker stop --timeout=-1 <worker IDs>` and wait for graceful completion; never substitute the ordinary finite stop timeout or cancel running jobs to accelerate a test. Other hosts continue processing work.

After every worker on that host has stopped, disconnect those stopped containers, remove only `windmill_default`, and recreate it with the saved name, subnet, gateway and Compose labels. A new Docker ID produces a new generated bridge name. Reconnect the original stopped containers with their saved aliases, apply reconciliation, reload UFW and verify again before restarting the workers with `docker start <worker IDs>`. Containers, images, volumes, application configuration and databases remain intact. Verify worker pings resume and new authenticated operations succeed; TCP connection checks alone are insufficient.

The acceptance matrix is local and peer Crate authenticated `SELECT current_user`, plus Qdrant authenticated collection reads over REST and gRPC, from the actual workers on `.11`, `.12`, `.13` and both worker types on `.20`. Compare unrelated persistent and active rules before/after. Confirm the obsolete bridge references are absent from owned rules, the timer is enabled and a second apply is idempotent. A host reboot is unnecessary disruption: boot persistence is verified from enabled units and service execution, while actual network recreation and UFW reload exercise the changing state.

## Rollback

Stop the reconciliation timer first so it cannot undo an operator rollback. Retain the protected pre-rollout network metadata and rule snapshot. If a worker network must be restored, drain only its workers without a hard timeout, disconnect their stopped containers and recreate `windmill_default` with its saved subnet/labels and explicit `com.docker.network.bridge.name=<old bridge>`. Reconnect saved aliases, restore only the recorded worker rules using the snapshot's inverse UFW arguments, reload UFW, then restart the original containers. Validate authenticated operations and a fresh SSH session before removing the service/configuration. Never restore an entire saved iptables ruleset over Docker's current rules or erase unrelated UFW entries.

After an ordinary rule-only rollback, execute only that apply snapshot's exact inverse commands. Review the current network first: restoring an old bridge-specific allowance on a different live bridge would intentionally not grant access. Keep reconciliation disabled until configuration and the actual network agree.

References: [Docker bridge options](https://docs.docker.com/engine/network/drivers/bridge/), [Docker graceful stop and unlimited timeout](https://docs.docker.com/reference/cli/docker/container/stop/), [Windmill graceful worker shutdown](https://www.windmill.dev/docs/advanced/self_host), [Ubuntu UFW rule syntax](https://manpages.ubuntu.com/manpages/jammy/man8/ufw.8.html).
