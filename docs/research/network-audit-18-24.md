# Private service connectivity audit: 10.0.0.18–24

Read-only live SSH audit, 2026-09-10 08:31–08:34 UTC. No firewall, service, container, or database changes. Trusted existing SSH keys only; BatchMode and a three-second connection timeout. Tests below measure **TCP connectivity**, not authentication, Mongo replica health, or successful Qdrant publication.

| Host | Inventory relevant to this audit | Result |
| --- | --- | --- |
| .18 `gw-mongo2` | Default Windmill worker `172.18.0.2`; host-network Mongo listens on **28017** | Host and local worker connect to local Mongo. Worker also connects to .19 Mongo and .20 Qdrant REST/gRPC. |
| .19 `gw-mongo3` | Default Windmill worker `172.18.0.2`; host-network Mongo on **28017** | Host and local worker connect to local Mongo. Worker also connects to .18 Mongo and .20 Qdrant REST/gRPC. |
| .20 `gw-vector1` | Default and highperf Windmill workers on `windmill_default` (`172.18.0.0/16`); Qdrant publishes private ports 6333–6335 | **Both local workers time out on .20:6333 and :6334**, while host connections succeed. Both workers connect to .18/.19 Mongo. |
| .21 `abusive` | Default Windmill worker `172.25.0.2`; Coolify applications/proxy; no local published Crate/Qdrant/Redis/Mongo endpoint | Worker and host connect to .18/.19 Mongo and .20 Qdrant REST/gRPC. No same-host database test applicable for these services. |
| .22 | SSH connection timed out | Not audited; cannot infer absent host or healthy networking. |
| .23 | SSH connection timed out | Not audited. |
| .24 | SSH connection timed out | Not audited. |

No additional instance of the same-host failure was reproduced in this range beyond Qdrant on .20. Mongo's actual port is 28017: initial tests against conventional port 27017 were discarded as service-health evidence after listener discovery.

## Evidence and interpretation

Primary observations were collected via `docker ps --format '{{.Names}}|{{.Networks}}|{{.Ports}}'`, `ss -lntH`, restricted `docker inspect` network fields, `docker network inspect ... --format '{{json .IPAM.Config}}'`, `iptables -S INPUT`, `iptables -S ufw-user-input`, and `iptables -t nat -S DOCKER`. No environment or connection credentials were printed.

Connection probes used existing host Python and `docker exec <actual-worker> python3 -c ...` with `socket.create_connection((host, port), 2)`, immediately closing successful sockets. Successful probes generally completed in 0–10 ms. Each failed local Qdrant probe reached the approximately 2002–2003 ms timeout. Both ports were tested independently from both workers. Cross-host .18/.19/.21 workers succeeded on those same Qdrant ports.

On .18 and .19, INPUT defaults to DROP, but UFW already permits source `172.18.0.0/16` and `172.28.0.0/24` to the specific host-private destination on TCP 28017, in addition to the private-LAN allowance. This matches the successful current local-worker connection; persistence after network recreation was not tested.

On .20, INPUT defaults to DROP and UFW permits Qdrant 6333/6334 only from `10.0.0.0/24`. The actual default worker source is `172.18.0.3`. The DOCKER NAT chain returns traffic entering the Windmill bridge `br-5dfeed115e72` before the Qdrant DNAT rules. Thus the request remains host-destined and the existing private-LAN allowance does not match the local container source. This reproduces the prior [Qdrant investigation](postgres-retirement-qdrant-connectivity.md), which also captured SYN retransmissions. No new packet tracing or rule modification was needed.

## Recommended ticket scope

Apply the narrow, persistent UFW host-input allowance for the Windmill network to .20 TCP 6333/6334, as described in the Qdrant research. Keep the correct internal endpoint `10.0.0.20`; do not open arbitrary ports, disable Docker isolation, or allow all Docker subnets. Manage network identity/subnet changes in deployment configuration. Validate authenticated read operations from both local workers and other eligible workers afterward, then replay a publication. TCP success alone is insufficient acceptance evidence.

Retain the working Mongo restrictions; no new Mongo firewall fix is justified by these probes. Record .22–24 as an audit coverage gap rather than adding speculative configuration changes.
