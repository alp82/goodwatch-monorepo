"""Reconcile only explicitly owned local worker INPUT permissions."""

import argparse
import fcntl
import ipaddress
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
from typing import Any, NamedTuple, Protocol


class Host(Protocol):
    def inspect(self, name: str) -> dict[str, Any] | None: ...
    def persistent(self) -> list[list[str]]: ...
    def active(self, rule: list[str]) -> bool: ...
    def execute(self, rule: list[str], delete: bool = False) -> None: ...


PREFIX = "gw-worker:"
PORTS = {
    "10.0.0.11": [4200],
    "10.0.0.12": [4200],
    "10.0.0.13": [4200],
    "10.0.0.20": [6333, 6334],
    "10.0.0.14": [6379],
    "10.0.0.15": [6379],
    "10.0.0.16": [6379],
}
LEGACY = {
    4200: "Windmill to local Crate HTTP",
    6333: "Windmill to local Qdrant HTTP",
    6334: "Windmill to local Qdrant gRPC",
}


class InputRule(NamedTuple):
    """A validated canonical TCP INPUT rule; unrelated UFW commands stay opaque."""

    interface: str
    source: str
    destination: str
    port: str
    comment: str

    def argv(self) -> list[str]:
        return [
            "allow",
            "in",
            "on",
            self.interface,
            "from",
            self.source,
            "to",
            self.destination,
            "port",
            self.port,
            "proto",
            "tcp",
            "comment",
            self.comment,
        ]

    @classmethod
    def parse(cls, argv: list[str]) -> "InputRule | None":
        if not (
            len(argv) == 14
            and argv[:3] == ["allow", "in", "on"]
            and argv[4] == "from"
            and argv[6] == "to"
            and argv[8] == "port"
            and argv[10:13] == ["proto", "tcp", "comment"]
        ):
            return None
        return cls(argv[3], argv[5], argv[7], argv[9], argv[13])


def reconcile(
    config: dict[str, Any],
    host: Host,
    apply: bool = False,
    expected_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    destination = config["destination"]
    if config["ports"] != PORTS.get(destination):
        raise ValueError("Unapproved destination/ports")
    entries = config["networks"]
    if (
        not entries
        or len(entries) > 2
        or len({e["name"] for e in entries}) != len(entries)
    ):
        raise ValueError("Ambiguous configured networks")
    for entry in entries:
        if not all(
            re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", entry[k])
            for k in ("name", "project", "compose_network")
        ):
            raise ValueError("Invalid network identity")
        for subnet in entry["subnets"]:
            parsed = ipaddress.ip_network(subnet)
            if not isinstance(parsed, ipaddress.IPv4Network) or not any(
                parsed.subnet_of(ipaddress.IPv4Network(private))
                for private in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
            ):
                raise ValueError("Subnet must be private IPv4")
    desired = []
    for entry in config["networks"]:
        network = host.inspect(entry["name"])
        if network is None:
            continue
        labels = network["Labels"]
        if (
            network["Name"] != entry["name"]
            or network["Driver"] != "bridge"
            or network.get("EnableIPv6")
            or network.get("Internal")
            or labels.get("com.docker.compose.project") != entry["project"]
            or labels.get("com.docker.compose.network") != entry["compose_network"]
            or len(network["IPAM"]["Config"]) != 1
            or network["IPAM"]["Config"][0]["Subnet"] not in entry["subnets"]
            or not re.fullmatch("[0-9a-f]{64}", network["Id"])
        ):
            raise ValueError("Docker network identity does not match configuration")
        subnet = network["IPAM"]["Config"][0]["Subnet"]
        interface = network["Options"].get(
            "com.docker.network.bridge.name", "br-" + network["Id"][:12]
        )
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,15}", interface):
            raise ValueError("Invalid bridge interface")
        for port in config["ports"]:
            desired.append(
                InputRule(
                    interface,
                    subnet,
                    destination,
                    str(port),
                    PREFIX + entry["name"] + ":" + str(port),
                ).argv()
            )
    current = host.persistent()
    owned = []
    for rule in current:
        comment = rule[-1] if len(rule) >= 2 and rule[-2] == "comment" else ""
        managed = comment.startswith(PREFIX)
        legacy = comment in LEGACY.values()
        if not managed and not legacy:
            continue
        parsed_rule = InputRule.parse(rule)
        if parsed_rule is None:
            if managed:
                raise ValueError("Owned UFW rule has invalid or unconfigured scope")
            continue
        scope = parsed_rule.destination == destination and parsed_rule.port in [
            str(p) for p in config["ports"]
        ]
        if managed:
            matching = [
                e
                for e in entries
                if comment == PREFIX + e["name"] + ":" + parsed_rule.port
            ]
            scope = (
                scope
                and bool(matching)
                and parsed_rule.source in matching[0]["subnets"]
                and bool(re.fullmatch(r"[a-zA-Z0-9_-]{1,15}", parsed_rule.interface))
            )
            if not scope:
                raise ValueError("Owned UFW rule has invalid or unconfigured scope")
        elif not (
            scope
            and parsed_rule.source == "172.18.0.0/16"
            and re.fullmatch(r"br-[0-9a-f]{12}", parsed_rule.interface)
            and comment == LEGACY[int(parsed_rule.port)]
        ):
            continue
        owned.append(rule)
    # Retain exact legacy equivalents rather than rewriting their comments.
    desired = [
        next((old for old in owned if old[:-1] == rule[:-1]), rule) for rule in desired
    ]
    add = [rule for rule in desired if rule not in current]
    remove = [rule for rule in owned if rule not in desired]
    if any(not host.active(rule) for rule in owned):
        raise RuntimeError("Persistent and active owned UFW rules disagree")
    plan = {
        "add": add,
        "remove": remove,
        "verified": False,
        "rollback": [["ufw"] + rule for rule in remove]
        + [["ufw", "--force", "delete"] + rule for rule in reversed(add)],
    }
    if expected_plan is not None and any(
        plan[k] != expected_plan[k] for k in ("add", "remove")
    ):
        raise RuntimeError(
            "Firewall or Docker changed since snapshot; no changes applied"
        )
    if apply:
        for rule in add:
            host.execute(rule)
        # Do not delete old working permissions until replacement is verified.
        after_add = host.persistent()
        if any(rule not in after_add or not host.active(rule) for rule in desired):
            raise RuntimeError(
                "Replacement UFW verification failed; old rules retained"
            )
        for rule in remove:
            host.execute(rule, delete=True)
        after = host.persistent()
        expected = [rule for rule in current if rule not in remove] + add
        if sorted(after) != sorted(expected) or any(
            host.active(rule) for rule in remove
        ):
            raise RuntimeError("UFW final verification failed")
        plan["verified"] = True
    return plan


class LocalHost:
    """Read Docker identity and use UFW's own persistent rule representation."""

    def run(self, argv: list[str]) -> str:
        result = subprocess.run(
            argv,
            text=True,
            capture_output=True,
            timeout=30,
            env={**os.environ, "LC_ALL": "C"},
        )
        if result.returncode:
            raise RuntimeError("Host command failed: " + argv[0])
        return result.stdout

    def inspect(self, name: str) -> dict[str, Any] | None:
        names = self.run(
            ["docker", "network", "ls", "--format", "{{.Name}}"]
        ).splitlines()
        if names.count(name) > 1:
            raise ValueError("Ambiguous Docker network")
        if name not in names:
            return None
        found = json.loads(self.run(["docker", "network", "inspect", name]))
        if len(found) != 1:
            raise ValueError("Ambiguous Docker inspection")
        network = found[0]
        interface = network.get("Options", {}).get(
            "com.docker.network.bridge.name", "br-" + network["Id"][:12]
        )
        if (
            not re.fullmatch(r"[a-zA-Z0-9_-]{1,15}", interface)
            or not Path("/sys/class/net", interface, "bridge").is_dir()
        ):
            raise ValueError("Docker bridge interface missing")
        return network

    def persistent(self) -> list[list[str]]:
        lines = self.run(["ufw", "show", "added"]).splitlines()
        if not lines or not lines[0].startswith("Added user rules"):
            raise RuntimeError("Unrecognized UFW persistent output")
        rules = []
        for line in lines[1:]:
            if not line.strip():
                continue
            argv = shlex.split(line)
            if not argv or argv[0] != "ufw":
                raise RuntimeError("Unrecognized UFW rule")
            rules.append(argv[1:])
        return rules

    def active(self, rule: list[str]) -> bool:
        status = self.run(["ufw", "status", "numbered"])
        if not status.startswith("Status: active\n"):
            raise RuntimeError("UFW must already be active")
        parsed = InputRule.parse(rule)
        if parsed is None:
            raise ValueError("Cannot verify a noncanonical INPUT rule")
        expected = (
            f"{parsed.destination} {parsed.port}/tcp on {parsed.interface} "
            f"ALLOW IN {parsed.source} # {parsed.comment}"
        )
        for line in status.splitlines():
            clean = re.sub(r"^\[\s*\d+\]\s*", "", line)
            if " ".join(clean.split()) == expected:
                return True
        return False

    def execute(self, rule: list[str], delete: bool = False) -> None:
        self.run(["ufw"] + (["--force", "delete"] if delete else []) + rule)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--snapshot", help="Exclusive new JSON rollback snapshot, required for apply"
    )
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error("Run as root to inspect UFW and lock reconciliation")
    path = Path(args.config)
    stat = path.stat()
    if stat.st_uid != 0 or stat.st_mode & 0o022 or path.is_symlink():
        parser.error(
            "Configuration must be root-owned, not writable by group/other, and not a symlink"
        )
    config = json.loads(path.read_text())
    host = LocalHost()
    addresses = json.loads(host.run(["ip", "-json", "address", "show"]))
    if not any(
        a.get("local") == config["destination"]
        for link in addresses
        for a in link.get("addr_info", [])
    ):
        parser.error("Configured private destination is not local to this host")
    with open("/run/lock/goodwatch-worker-firewall.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        plan = reconcile(config, host)
        if args.apply:
            if not args.snapshot:
                parser.error("--apply requires --snapshot for exact scoped rollback")
            if plan["add"] or plan["remove"]:
                fd = os.open(args.snapshot, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w") as snapshot:
                    json.dump(plan, snapshot, indent=2)
            applied = reconcile(config, host, apply=True, expected_plan=plan)
            if applied["add"] != plan["add"] or applied["remove"] != plan["remove"]:
                raise RuntimeError(
                    "Firewall changed between snapshot and apply; inspect scoped snapshot"
                )
            plan = applied
        print(json.dumps(plan, indent=2))


if __name__ == "__main__":
    main()
