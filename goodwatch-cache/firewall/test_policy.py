import unittest
from policy import LocalRedisHost, reconcile_policy
from unittest.mock import patch
import subprocess
import tempfile
import json
from pathlib import Path
from typing import Any


class Host:
    def __init__(self, destination: str = "10.0.0.14") -> None:
        self.rules = [
            ["allow", "22/tcp"],
            ["allow", "from", "159.69.247.66", "to", "any", "port", "6379"],
            ["deny", "6379"],
        ]
        self.worker_settings = json.loads(
            (
                Path(__file__).resolve().parents[2]
                / "goodwatch-remote/firewall"
                / ("host-" + destination.rsplit(".", 1)[1] + ".json")
            ).read_text()
        )
        self.commands = []
        self.evidence = {
            "cluster_state": "ok",
            "slots_assigned": 16384,
            "slots_ok": 16384,
            "nodes": [
                {
                    "ip": ip,
                    "port": 6379,
                    "bus_port": 16379,
                    "flags": ["master"],
                    "connected": True,
                }
                for ip in ["10.0.0.14", "10.0.0.15", "10.0.0.16"]
            ],
            "public_connections": [],
        }
        self.snapshot = None

    def load_worker_config(self) -> dict:
        return self.worker_settings

    def persistent(self) -> list[list[str]]:
        return list(self.rules)

    def worker_plan(self, config: dict) -> dict:
        return {
            "add": [
                [
                    "allow",
                    "in",
                    "on",
                    "br-ef7f6d40b1ca",
                    "from",
                    config["networks"][0]["subnets"][0],
                    "to",
                    config["destination"],
                    "port",
                    "6379",
                    "proto",
                    "tcp",
                    "comment",
                    "gw-worker:windmill_default:6379",
                ]
            ],
            "remove": [],
        }

    def preflight(self) -> dict:
        return self.evidence

    def save_snapshot(self, plan: dict) -> None:
        self.snapshot = plan
        self.commands.append("snapshot")

    def execute(self, rule: list[str], delete: bool = False) -> None:
        self.commands.append("delete" if delete else "add")
        if delete:
            self.rules.remove(rule)
        else:
            if rule[:2] == ["allow", "22/tcp"]:
                self.rules = [r for r in self.rules if r[:2] != ["allow", "22/tcp"]]
            self.rules.append(rule)

    def enable(self) -> None:
        self.commands.append("enable")

    def verify(self, expected: list[list[str]]) -> bool:
        return sorted(self.rules) == sorted(expected)


class PolicyTest(unittest.TestCase):
    def test_source_port_cannot_hide_public_redis_destination(self) -> None:
        for rule in [
            [
                "allow",
                "from",
                "any",
                "port",
                "50000",
                "to",
                "any",
                "port",
                "6379",
                "proto",
                "tcp",
            ],
            ["allow", "from", "any", "port", "50000", "proto", "tcp"],
            ["allow", "from", "any", "port", "50000", "to", "any", "proto", "tcp"],
        ]:
            host = Host()
            host.rules.append(rule)
            with self.assertRaises(ValueError):
                reconcile_policy({"destination": "10.0.0.14"}, host)
        host = Host()
        safe = [
            "allow",
            "from",
            "any",
            "port",
            "50000",
            "to",
            "any",
            "port",
            "443",
            "proto",
            "tcp",
        ]
        host.rules.append(safe)
        self.assertIn(
            safe, reconcile_policy({"destination": "10.0.0.14"}, host)["preserve"]
        )

    def test_uses_shared_worker_scope_and_rejects_host_or_port_mismatch(self) -> None:
        host = Host()
        host.worker_settings["networks"][0]["subnets"] = ["172.28.0.0/24"]
        plan = reconcile_policy({"destination": "10.0.0.14"}, host)
        self.assertEqual(plan["add"][-1][5], "172.28.0.0/24")
        for field, value in [("destination", "10.0.0.15"), ("ports", [6333])]:
            host = Host()
            host.worker_settings[field] = value
            with self.assertRaises(ValueError):
                reconcile_policy({"destination": "10.0.0.14"}, host)
            self.assertEqual(host.commands, [])

    def test_rollback_restores_original_filter_policies_without_full_ruleset_restore(
        self,
    ) -> None:
        def command(argv: list[str], **kwargs: Any) -> subprocess.CompletedProcess:
            if argv[0] == "ufw":
                output = "Status: inactive\n"
            elif argv[-1] == "-S":
                output = "-P INPUT ACCEPT\n-P FORWARD DROP\n-P OUTPUT ACCEPT\n"
            else:
                output = "# saved diagnostic rules\n"
            return subprocess.CompletedProcess(argv, 0, output, "")

        defaults = 'DEFAULT_INPUT_POLICY="DROP"\nDEFAULT_OUTPUT_POLICY="ACCEPT"\nDEFAULT_FORWARD_POLICY="DROP"\n'
        with tempfile.TemporaryDirectory() as directory:
            target = str(Path(directory) / "rollback.json")
            plan = reconcile_policy({"destination": "10.0.0.14"}, Host())
            with (
                patch("reconcile.subprocess.run", side_effect=command),
                patch("policy.Path.read_text", return_value=defaults),
            ):
                LocalRedisHost("10.0.0.14", target).save_snapshot(plan)
            saved = json.loads(Path(target).read_text())
        self.assertIn(["iptables", "-P", "FORWARD", "DROP"], saved["plan"]["rollback"])
        self.assertIn(["ip6tables", "-P", "FORWARD", "DROP"], saved["plan"]["rollback"])
        self.assertFalse(
            any("restore" in command[0] for command in saved["plan"]["rollback"])
        )

    def test_each_node_has_only_its_two_private_bus_peers(self) -> None:
        for destination, peers in [
            ("10.0.0.14", ["10.0.0.15", "10.0.0.16"]),
            ("10.0.0.15", ["10.0.0.14", "10.0.0.16"]),
            ("10.0.0.16", ["10.0.0.14", "10.0.0.15"]),
        ]:
            plan = reconcile_policy({"destination": destination}, Host(destination))
            self.assertEqual([rule[5] for rule in plan["add"][1:3]], peers)
            self.assertEqual({rule[7] for rule in plan["add"]}, {destination})
            self.assertEqual({rule[9] for rule in plan["add"]}, {"6379", "16379"})

    def test_live_adapter_normalizes_private_nodes_and_detects_public_sockets(
        self,
    ) -> None:
        def command(argv: list[str], **kwargs: Any) -> subprocess.CompletedProcess:
            if argv[-2:] == ["CLUSTER", "INFO"]:
                output = "cluster_state:ok\ncluster_slots_assigned:16384\ncluster_slots_ok:16384\n"
            elif argv[-2:] == ["CLUSTER", "NODES"]:
                output = "\n".join(
                    f"node{i} 10.0.0.{i}:6379@16379 master - 0 1 1 connected 0-5460"
                    for i in [14, 15, 16]
                )
            elif argv[0] == "ss":
                output = "0 0 10.0.0.14:6379 10.0.0.10:42000\n0 0 10.0.0.14:16379 78.46.209.172:43000\n"
            else:
                raise AssertionError("Unexpected command")
            return subprocess.CompletedProcess(argv, 0, output, "")

        with patch("reconcile.subprocess.run", side_effect=command):
            evidence = LocalRedisHost("10.0.0.14").preflight()
        self.assertEqual(evidence["public_connections"], ["78.46.209.172"])
        self.assertEqual(
            [node["ip"] for node in evidence["nodes"]],
            ["10.0.0.14", "10.0.0.15", "10.0.0.16"],
        )
        self.assertEqual(evidence["slots_ok"], 16384)

    def test_activation_requires_private_healthy_topology_and_snapshots_before_writes(
        self,
    ) -> None:
        for fault in ("public_nodes", "public_connections", "slots", "replica"):
            host = Host()
            if fault == "public_nodes":
                host.evidence["nodes"][0]["ip"] = "78.46.209.172"
            if fault == "public_connections":
                host.evidence["public_connections"] = ["159.69.247.66"]
            if fault == "slots":
                host.evidence["slots_ok"] = 16000
            if fault == "replica":
                host.evidence["nodes"][0]["flags"] = ["slave"]
            with self.assertRaises(ValueError):
                reconcile_policy({"destination": "10.0.0.14"}, host, activate=True)
            self.assertEqual(host.commands, [])
        host = Host()
        plan = reconcile_policy({"destination": "10.0.0.14"}, host, activate=True)
        self.assertTrue(plan["verified"])
        self.assertEqual(
            host.commands,
            [
                "snapshot",
                "add",
                "add",
                "add",
                "add",
                "add",
                "delete",
                "delete",
                "enable",
            ],
        )
        assert host.snapshot is not None
        self.assertEqual(host.snapshot["rollback"][0], ["ufw", "--force", "disable"])

    def test_unrelated_web_rule_preserved_but_unknown_redis_or_broad_allow_aborts(
        self,
    ) -> None:
        host = Host()
        host.rules.append(["allow", "443/tcp"])
        self.assertIn(
            ["allow", "443/tcp"],
            reconcile_policy({"destination": "10.0.0.14"}, host)["preserve"],
        )
        for rule in [
            ["allow", "6379/tcp"],
            ["allow", "from", "192.0.2.1"],
            ["allow", "6300:6400/tcp"],
        ]:
            host = Host()
            host.rules.append(rule)
            with self.assertRaises(ValueError):
                reconcile_policy({"destination": "10.0.0.14"}, host)

    def test_review_plan_has_only_private_clients_two_peers_and_local_worker(
        self,
    ) -> None:
        host = Host()
        plan = reconcile_policy({"destination": "10.0.0.14"}, host)
        self.assertEqual(len(plan["add"]), 4)
        self.assertEqual(
            plan["add"][0],
            [
                "allow",
                "in",
                "on",
                "ens10",
                "from",
                "10.0.0.0/24",
                "to",
                "10.0.0.14",
                "port",
                "6379",
                "proto",
                "tcp",
                "comment",
                "Redis private clients",
            ],
        )
        self.assertEqual([r[5] for r in plan["add"][1:3]], ["10.0.0.15", "10.0.0.16"])
        self.assertEqual(plan["remove"], host.rules[1:])
        self.assertEqual(plan["update"], [["allow", "22/tcp", "comment", "SSH admin"]])
        self.assertEqual(plan["preserve"], [])
        self.assertEqual(host.commands, [])


if __name__ == "__main__":
    unittest.main()
