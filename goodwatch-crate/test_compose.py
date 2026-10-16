"""The node command that Compose renders from docker-compose.yml (#562). Needs `docker compose`; skipped without it.

Run: python3 -m unittest discover -s goodwatch-crate -p 'test_compose.py'
"""
import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENV = {
    "CRATE_VERSION": "5.10.16", "NODE_NAME": "crate-01", "SELF_IP": "10.0.0.11", "HEAP_SIZE": "16g",
    "CLUSTER_NAME": "crate-cluster", "SEED_HOSTS": "10.0.0.11,10.0.0.12,10.0.0.13",
    "MASTER_NODES": "crate-01,crate-02,crate-03", "EXPECTED_NODES": "3",
}
RULES = [
    "-Cauth.host_based.config.0.user=crate",
    "-Cauth.host_based.config.0.address=127.0.0.1",
    "-Cauth.host_based.config.0.method=trust",
    "-Cauth.host_based.config.1.method=password",
]


def rendered(**extra):
    environ = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "DOCKER_HOST")} | ENV | extra
    output = subprocess.run(
        ["docker", "compose", "-f", str(HERE / "docker-compose.yml"), "-p", "hba-compose-test", "config",
         "--format", "json"],
        env=environ, capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(output)["services"]["cratedb"]["command"]


@unittest.skipUnless(shutil.which("docker") and subprocess.run(["docker", "compose", "version"],
                     capture_output=True).returncode == 0, "docker compose is not available")
class ComposeCommandTest(unittest.TestCase):
    def test_every_argument_is_a_setting(self):
        # A "#" line inside the folded command became four arguments, and the node dropped every -C after them.
        command = rendered()
        self.assertEqual(command[0], "crate")
        self.assertEqual([arg for arg in command[1:] if not arg.startswith("-C")], [])

    def test_hba_stays_off_without_the_variable(self):
        command = rendered()
        self.assertIn("-Cauth.host_based.enabled=false", command)
        self.assertEqual(command[-5:], ["-Cauth.host_based.enabled=false", *RULES])

    def test_the_variable_turns_hba_on_with_the_same_rules(self):
        command = rendered(CRATE_HBA_ENABLED="true")
        self.assertEqual(command[-5:], ["-Cauth.host_based.enabled=true", *RULES])

    def test_the_other_settings_are_unchanged(self):
        self.assertEqual(rendered()[:13], [
            "crate", "-Ccluster.name=crate-cluster", "-Cnode.name=crate-01", "-Cnetwork.host=0.0.0.0",
            "-Cnetwork.publish_host=10.0.0.11", "-Ctransport.publish_port=4300",
            "-Cdiscovery.seed_hosts=10.0.0.11,10.0.0.12,10.0.0.13",
            "-Ccluster.initial_master_nodes=crate-01,crate-02,crate-03", "-Cgateway.expected_data_nodes=3",
            "-Cgateway.recover_after_data_nodes=3", "-Cpath.data=/data", "-Cpath.repo=/snapshots",
            "-Cauth.host_based.enabled=false",
        ])


if __name__ == "__main__":
    unittest.main()
