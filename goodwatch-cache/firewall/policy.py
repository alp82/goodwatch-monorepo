"""Plan the reviewed private Redis firewall policy; activation is explicit."""

import sys
from pathlib import Path
from typing import Any
import re

shared = Path(__file__).resolve().parents[2] / "goodwatch-remote/firewall"
if not shared.is_dir():
    shared = Path("/usr/local/lib/goodwatch-worker-firewall")
sys.path.insert(0, str(shared))
from reconcile import InputRule, LocalHost as WorkerHost, reconcile  # pyright: ignore[reportMissingImports]
# The shared module is located above from either the checkout or its installed path.

PUBLIC = {
    "10.0.0.14": "78.46.209.172",
    "10.0.0.15": "168.119.242.21",
    "10.0.0.16": "91.107.208.205",
}


def could_expose_redis(rule: list[str]) -> bool:
    if not any(action in rule for action in ("allow", "limit")):
        return False
    if "proto" in rule and rule[rule.index("proto") + 1] == "udp":
        return False
    if "to" in rule:
        if rule.count("to") != 1:
            return True
        destination = rule[rule.index("to") + 1 :]
        if destination.count("port") != 1:
            return True
        value = destination[destination.index("port") + 1]
    elif "from" in rule:
        # A source port restricts callers, never the destination service.
        return True
    elif len(rule) >= 2 and rule[0] in ("allow", "limit"):
        value = rule[1]
    else:
        return True
    if value.endswith("/udp"):
        return False
    value = value.removesuffix("/tcp")
    if not re.fullmatch(r"[0-9,:]+", value):
        return True
    for segment in value.split(","):
        limits = segment.split(":")
        if len(limits) > 2 or any(not x for x in limits):
            return True
        low, high = int(limits[0]), int(limits[-1])
        if any(low <= port <= high for port in (6379, 16379, 16380, 16381)):
            return True
    return False


def reconcile_policy(
    config: dict[str, Any], host: Any, activate: bool = False
) -> dict[str, Any]:
    destination = config["destination"]
    if destination not in PUBLIC:
        raise ValueError("Unapproved Redis host")
    current = host.persistent()
    peers = [ip for ip in PUBLIC if ip != destination]
    legacy = [
        ["allow", "from", ip, "to", "any", "port", str(port)]
        for ip, ports in [("159.69.247.66", [6379]), ("167.235.251.11", [6379])]
        + [(PUBLIC[peer], [6379, 16379, 16380, 16381]) for peer in peers]
        for port in ports
    ] + [["deny", "6379"]]
    desired = [
        InputRule(
            "ens10", "10.0.0.0/24", destination, "6379", "Redis private clients"
        ).argv()
    ]
    desired += [
        InputRule("ens10", peer, destination, "16379", "Redis cluster peer").argv()
        for peer in peers
    ]
    settings = host.load_worker_config()
    if settings.get("destination") != destination or settings.get("ports") != [6379]:
        raise ValueError(
            "Worker firewall configuration does not match Redis host and port"
        )
    workers = host.worker_plan(settings)
    desired += workers["add"]
    remove = [rule for rule in current if rule in legacy or rule in workers["remove"]]
    for rule in current:
        parsed = InputRule.parse(rule)
        managed_worker = (
            parsed is not None and parsed.comment == "gw-worker:windmill_default:6379"
        )
        if (
            rule not in desired
            and rule not in remove
            and not managed_worker
            and could_expose_redis(rule)
        ):
            raise ValueError(
                "Unexpected Redis exposure; review complete policy before activation"
            )
    ssh_rule = ["allow", "22/tcp", "comment", "SSH admin"]
    ssh_old = ["allow", "22/tcp"]
    if ssh_old not in current and ssh_rule not in current:
        raise ValueError("Expected existing SSH permission missing")
    add = [rule for rule in desired if rule not in current]
    updates = [ssh_rule] if ssh_old in current else []
    plan = {
        "update": updates,
        "add": add,
        "remove": remove,
        "preserve": [
            rule
            for rule in current
            if rule not in remove and not (updates and rule == ssh_old)
        ],
        "defaults": {"incoming": "deny", "outgoing": "allow", "routed": "deny"},
        "verified": False,
        "rollback": [["ufw", "--force", "disable"]]
        + ([["ufw", "allow", "22/tcp", "comment", ""]] if updates else [])
        + [["ufw"] + rule for rule in remove]
        + [["ufw", "--force", "delete"] + rule for rule in reversed(add)],
    }
    if activate:
        evidence = host.preflight()
        nodes = evidence["nodes"]
        if (
            evidence["cluster_state"] != "ok"
            or evidence["slots_assigned"] != 16384
            or evidence["slots_ok"] != 16384
            or len(nodes) != 3
            or {n["ip"] for n in nodes} != set(PUBLIC)
            or any(
                n["port"] != 6379
                or n["bus_port"] != 16379
                or not n["connected"]
                or "master" not in n["flags"]
                or set(n["flags"]) - {"master", "myself"}
                for n in nodes
            )
            or evidence["public_connections"]
        ):
            raise ValueError(
                "Private healthy Redis topology and connections must be verified before activation"
            )
        if host.persistent() != current:
            raise RuntimeError("UFW policy changed during preflight; review again")
        host.save_snapshot(plan)
        for rule in updates:
            host.execute(rule)
        for rule in add:
            host.execute(rule)
        for rule in remove:
            host.execute(rule, delete=True)
        host.enable()
        if not host.verify(plan["preserve"] + updates + add):
            raise RuntimeError(
                "Activated policy verification failed; use saved scoped rollback"
            )
        plan["verified"] = True
    return plan


class LocalRedisHost(WorkerHost):
    def __init__(
        self,
        destination: str,
        snapshot: str | None = None,
        worker_config_path: str = "/etc/goodwatch-worker-firewall.json",
    ) -> None:
        self.destination = destination
        self.snapshot = snapshot
        self.worker_config_path = Path(worker_config_path)

    def load_worker_config(self) -> dict[str, Any]:
        import json

        path = self.worker_config_path
        stat = path.stat()
        if stat.st_uid != 0 or stat.st_mode & 0o022 or path.is_symlink():
            raise ValueError(
                "Worker configuration must be root-owned and not writable by group/other"
            )
        return json.loads(path.read_text())

    def worker_plan(self, config: dict[str, Any]) -> dict[str, Any]:
        if self.inspect("windmill_default") is None:
            raise ValueError("Expected local worker network is absent")
        return reconcile(config, self)

    def redis(self, *arguments: str) -> str:
        name = (
            "main-redis-main-1"
            if self.destination == "10.0.0.14"
            else "replica-redis-replica-1"
        )
        return self.run(
            [
                "docker",
                "exec",
                name,
                "sh",
                "-c",
                'export REDISCLI_AUTH="$REDIS_PASSWORD"; exec redis-cli --no-auth-warning "$@"',
                "sh",
                *arguments,
            ]
        )

    def preflight(self) -> dict[str, Any]:
        import ipaddress

        info = dict(
            line.split(":", 1)
            for line in self.redis("CLUSTER", "INFO").splitlines()
            if ":" in line
        )
        nodes = []
        for line in self.redis("CLUSTER", "NODES").splitlines():
            fields = line.split()
            endpoint, bus = fields[1].split("@", 1)
            address, port = endpoint.rsplit(":", 1)
            nodes.append(
                {
                    "ip": address,
                    "port": int(port),
                    "bus_port": int(bus.split(",")[0]),
                    "flags": fields[2].split(","),
                    "connected": fields[7] == "connected",
                }
            )
        public_connections = []
        for line in self.run(["ss", "-Hnt", "state", "established"]).splitlines():
            endpoints = [part.rsplit(":", 1) for part in line.split()[-2:]]
            if not any(port in ("6379", "16379") for _, port in endpoints):
                continue
            for address, _ in endpoints:
                ip = ipaddress.ip_address(address.strip("[]"))
                private = ip.is_loopback or (
                    isinstance(ip, ipaddress.IPv4Address)
                    and any(
                        ip in ipaddress.IPv4Network(net)
                        for net in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
                    )
                )
                if not private:
                    public_connections.append(str(ip))
        return {
            "cluster_state": info.get("cluster_state"),
            "slots_assigned": int(info.get("cluster_slots_assigned", "0")),
            "slots_ok": int(info.get("cluster_slots_ok", "0")),
            "nodes": nodes,
            "public_connections": sorted(set(public_connections)),
        }

    def save_snapshot(self, plan: dict[str, Any]) -> None:
        import json
        import os

        if not self.snapshot:
            raise ValueError(
                "Activation requires an exclusive new rollback snapshot path"
            )
        status = self.run(["ufw", "status", "verbose"])
        if not status.startswith("Status: inactive"):
            raise ValueError(
                "This staged activation expects inactive UFW; do not overwrite an active policy"
            )
        saved_defaults = Path("/etc/default/ufw").read_text()
        actions = {"ACCEPT": "allow", "DROP": "deny", "REJECT": "reject"}
        restore = []
        for kind, variable in [
            ("incoming", "INPUT"),
            ("outgoing", "OUTPUT"),
            ("routed", "FORWARD"),
        ]:
            match = re.search(
                r"^DEFAULT_" + variable + r'_POLICY="([A-Z]+)"', saved_defaults, re.M
            )
            if match is None or match[1] not in actions:
                raise ValueError("Unrecognized existing UFW defaults")
            restore.append(["ufw", "default", actions[match[1]], kind])
        plan["rollback"][1:1] = restore
        # UFW disable can change Docker's original FORWARD default. Restore only
        # the three built-in chain policies, never an entire saved ruleset.
        builtin_policies = {}
        for binary in ["iptables", "ip6tables"]:
            output = self.run([binary, "-S"])
            policies = [
                line.split() for line in output.splitlines() if line.startswith("-P ")
            ]
            if {parts[1] for parts in policies} != {"INPUT", "OUTPUT", "FORWARD"}:
                raise ValueError("Unrecognized initial filter policies")
            if any(
                len(parts) != 3 or parts[2] not in {"ACCEPT", "DROP"}
                for parts in policies
            ):
                raise ValueError("Unrecognized initial filter policy action")
            builtin_policies[binary] = policies
            plan["rollback"].extend([[binary] + parts for parts in policies])
        snapshot = {
            "plan": plan,
            "builtin_policies": builtin_policies,
            "before": {
                name: Path(name).read_text()
                for name in [
                    "/etc/default/ufw",
                    "/etc/ufw/ufw.conf",
                    "/etc/ufw/user.rules",
                    "/etc/ufw/user6.rules",
                ]
            },
            "iptables": self.run(["iptables-save"]),
            "ip6tables": self.run(["ip6tables-save"]),
        }
        fd = os.open(self.snapshot, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as handle:
            json.dump(snapshot, handle, indent=2)

    def enable(self) -> None:
        for direction, policy in [
            ("incoming", "deny"),
            ("outgoing", "allow"),
            ("routed", "deny"),
        ]:
            self.run(["ufw", "default", policy, direction])
        self.run(["ufw", "--force", "enable"])

    def verify(self, expected: list[list[str]]) -> bool:
        if sorted(self.persistent()) != sorted(expected):
            return False
        if any(not self.active(rule) for rule in expected if InputRule.parse(rule)):
            return False
        status = self.run(["ufw", "status", "verbose"])
        return (
            "Status: active" in status
            and "deny (incoming), allow (outgoing), deny (routed)" in status
            and all(
                fragment in status for fragment in ["22/tcp", "ALLOW IN", "# SSH admin"]
            )
        )


def main() -> None:
    import argparse
    import fcntl
    import json
    import os

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True, choices=list(PUBLIC))
    parser.add_argument("--activate", action="store_true")
    parser.add_argument("--snapshot")
    parser.add_argument(
        "--worker-config", default="/etc/goodwatch-worker-firewall.json"
    )
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error(
            "Root is required to inspect UFW and acquire the shared policy lock"
        )
    if args.activate and not args.snapshot:
        parser.error("--activate requires --snapshot NEW_PATH")
    host = LocalRedisHost(args.host, args.snapshot, args.worker_config)
    addresses = json.loads(host.run(["ip", "-json", "address", "show", "dev", "ens10"]))
    if not any(
        a.get("local") == args.host
        for link in addresses
        for a in link.get("addr_info", [])
    ):
        parser.error("Configured Redis address is not owned by private interface ens10")
    with open("/run/lock/goodwatch-worker-firewall.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        print(
            json.dumps(
                reconcile_policy(
                    {"destination": args.host}, host, activate=args.activate
                ),
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
