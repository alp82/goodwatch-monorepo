import unittest
from reconcile import LocalHost, reconcile
from unittest.mock import patch
import subprocess
from typing import Any


class Host:
    def __init__(self) -> None:
        self.network = {
            "Name": "windmill_default",
            "Id": "a" * 64,
            "Driver": "bridge",
            "Internal": False,
            "EnableIPv6": False,
            "Options": {},
            "Labels": {
                "com.docker.compose.project": "windmill",
                "com.docker.compose.network": "default",
            },
            "IPAM": {"Config": [{"Subnet": "172.18.0.0/16"}]},
        }
        self.rules = []
        self.commands = []

    def inspect(self, name: str) -> dict[str, Any] | None:
        return self.network

    def persistent(self) -> list[list[str]]:
        return list(self.rules)

    def active(self, rule: list[str]) -> bool:
        return rule in self.rules

    def execute(self, rule: list[str], delete: bool = False) -> None:
        self.commands.append((delete, rule))
        if delete:
            self.rules.remove(rule)
        else:
            self.rules.append(rule)


def config() -> dict[str, Any]:
    return {
        "destination": "10.0.0.20",
        "ports": [6333, 6334],
        "networks": [
            {
                "name": "windmill_default",
                "project": "windmill",
                "compose_network": "default",
                "subnets": ["172.18.0.0/16", "172.28.0.0/24"],
            }
        ],
    }


class ReconcileTest(unittest.TestCase):
    def test_recreation_adds_before_removing_and_preserves_unrelated(self) -> None:
        host = Host()
        reconcile(config(), host, apply=True)
        old = list(host.rules)
        unrelated = ["allow", "22/tcp"]
        host.rules.append(unrelated)
        host.network["Id"] = "b" * 64
        host.network["IPAM"]["Config"][0]["Subnet"] = "172.28.0.0/24"
        host.commands.clear()
        result = reconcile(config(), host, apply=True)
        self.assertEqual(
            [delete for delete, _ in host.commands], [False, False, True, True]
        )
        self.assertEqual(result["remove"], old)
        self.assertIn(unrelated, host.rules)

    def test_invalid_network_leaves_existing_rules_untouched(self) -> None:
        for change in ("subnet", "label", "driver", "ipv6", "ambiguous"):
            with self.subTest(change=change):
                host = Host()
                reconcile(config(), host, apply=True)
                host.commands.clear()
                if change == "subnet":
                    host.network["IPAM"]["Config"][0]["Subnet"] = "0.0.0.0/0"
                if change == "label":
                    host.network["Labels"]["com.docker.compose.project"] = "unrelated"
                if change == "driver":
                    host.network["Driver"] = "host"
                if change == "ipv6":
                    host.network["EnableIPv6"] = True
                if change == "ambiguous":
                    host.network["IPAM"]["Config"].append({"Subnet": "172.19.0.0/16"})
                with self.assertRaises(ValueError):
                    reconcile(config(), host, apply=True)
                self.assertEqual(host.commands, [])

    def test_exact_legacy_rules_adopted_without_reapplication(self) -> None:
        host = Host()
        rules = reconcile(config(), host)["add"]
        rules[0][-1] = "Windmill to local Qdrant HTTP"
        rules[1][-1] = "Windmill to local Qdrant gRPC"
        host.rules = rules
        self.assertEqual(reconcile(config(), host, apply=True)["add"], [])
        self.assertEqual(host.commands, [])
        host.network["Id"] = "c" * 64
        self.assertEqual(len(reconcile(config(), host, apply=True)["remove"]), 2)

    def test_absence_removes_owned_but_docker_error_preserves(self) -> None:
        host = Host()
        reconcile(config(), host, apply=True)
        host.commands.clear()

        def unavailable(name: str) -> None:
            raise RuntimeError("Docker unavailable")

        host.inspect = unavailable
        with self.assertRaises(RuntimeError):
            reconcile(config(), host, apply=True)
        self.assertEqual(host.commands, [])
        host.inspect = lambda name: None
        self.assertEqual(len(reconcile(config(), host, apply=True)["remove"]), 2)

    def test_malformed_owner_rule_and_inactive_rule_fail_closed(self) -> None:
        host = Host()
        host.rules = [["allow", "22/tcp", "comment", "gw-worker:bad"]]
        with self.assertRaises(ValueError):
            reconcile(config(), host, apply=True)
        self.assertEqual(host.commands, [])
        host = Host()
        reconcile(config(), host, apply=True)
        host.commands.clear()
        host.active = lambda rule: False
        with self.assertRaises(RuntimeError):
            reconcile(config(), host, apply=True)
        self.assertEqual(host.commands, [])

    def test_adapter_reads_real_ufw_formats_and_rejects_inactive(self) -> None:
        host = LocalHost()
        added = "Added user rules (see 'ufw status' for running firewall):\nufw allow in on br-5dfeed115e72 from 172.18.0.0/16 to 10.0.0.20 port 6333 proto tcp comment 'Windmill to local Qdrant HTTP'\n"
        status = "Status: active\n[ 7] 10.0.0.20 6333/tcp on br-5dfeed115e72 ALLOW IN    172.18.0.0/16 # Windmill to local Qdrant HTTP\n"
        with patch(
            "reconcile.subprocess.run",
            side_effect=[
                subprocess.CompletedProcess([], 0, added),
                subprocess.CompletedProcess([], 0, status),
            ],
        ):
            rules = host.persistent()
            self.assertEqual(len(rules), 1)
            self.assertTrue(host.active(rules[0]))
        with patch(
            "reconcile.subprocess.run",
            return_value=subprocess.CompletedProcess([], 0, "Status: inactive\n"),
        ):
            with self.assertRaises(RuntimeError):
                host.active(rules[0])

    def test_replacement_verification_failure_retains_old_permissions(self) -> None:
        host = Host()
        reconcile(config(), host, apply=True)
        old = list(host.rules)
        host.network["Id"] = "b" * 64
        host.active = lambda rule: rule in old
        with self.assertRaises(RuntimeError):
            reconcile(config(), host, apply=True)
        self.assertTrue(all(rule in host.rules for rule in old))

    def test_snapshot_change_refuses_writes_and_rollback_is_scoped(self) -> None:
        host = Host()
        plan = reconcile(config(), host)
        self.assertEqual(plan["rollback"][0][:3], ["ufw", "--force", "delete"])
        host.network["Id"] = "d" * 64
        with self.assertRaises(RuntimeError):
            reconcile(config(), host, apply=True, expected_plan=plan)
        self.assertEqual(host.commands, [])

    def test_redis_hosts_reconcile_only_local_client_port(self) -> None:
        for destination in ["10.0.0.14", "10.0.0.15", "10.0.0.16"]:
            settings = config()
            settings["destination"] = destination
            settings["ports"] = [6379]
            plan = reconcile(settings, Host())
            self.assertEqual(len(plan["add"]), 1)
            self.assertEqual(plan["add"][0][7:10], [destination, "port", "6379"])
            self.assertEqual(plan["add"][0][-1], "gw-worker:windmill_default:6379")

    def test_dry_run_then_apply_scopes_ports_and_is_idempotent(self) -> None:
        host = Host()
        plan = reconcile(config(), host)
        self.assertEqual(len(plan["add"]), 2)
        self.assertEqual(host.commands, [])
        self.assertEqual(
            plan["add"][0],
            [
                "allow",
                "in",
                "on",
                "br-aaaaaaaaaaaa",
                "from",
                "172.18.0.0/16",
                "to",
                "10.0.0.20",
                "port",
                "6333",
                "proto",
                "tcp",
                "comment",
                "gw-worker:windmill_default:6333",
            ],
        )
        result = reconcile(config(), host, apply=True)
        self.assertTrue(result["verified"])
        self.assertEqual(reconcile(config(), host)["add"], [])


if __name__ == "__main__":
    unittest.main()
