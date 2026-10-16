"""Which HBA rules does a node apply for a given command line? One single-node container per variant.

    uv run --with requests python docs/implementation/auth/cratedb-hba-lab/argv_probe.py

Container hba-argv-probe, host network, 127.0.0.21:16330-16332. Writes results/argv-probe.json.
"""
import json
import subprocess
import time
from pathlib import Path

import requests

IMAGE = "crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307"
NAME, HOST = "hba-argv-probe", "127.0.0.21"
BASE = ["crate", "-Cdiscovery.type=single-node", f"-Cnetwork.host={HOST}", "-Chttp.port=16330",
        "-Ctransport.port=16331", "-Cpsql.port=16332", "-Ccluster.routing.allocation.disk.threshold_enabled=false"]
TODAY = ["-Cauth.host_based.config.0.user=crate", "-Cauth.host_based.config.0.address=127.0.0.99",
         "-Cauth.host_based.config.0.method=trust", "-Cauth.host_based.config.1.method=password"]
COMMENT = ["#", "host-based", "auth", "map"]
ON = ["-Cauth.host_based.enabled=true"]
VARIANTS = {
    "today's rules after the comment tokens, enabled appended (naive)": COMMENT + TODAY + ON,
    "today's rules without the comment tokens, enabled appended": TODAY + ON,
    "enabled first, then the comment tokens and today's rules": ON + COMMENT + TODAY,
    "comment tokens, then a node name": COMMENT + ["-Cnode.name=named-after-comment"],
}


def sql(header=None):
    headers = {"Authorization": header} if header else {}
    try:
        r = requests.post(f"http://{HOST}:16330/_sql", json={"stmt": "SELECT current_user, name FROM sys.nodes"},
                          headers=headers, timeout=10)
        if r.status_code == 200:
            return r.json()["rows"][0]
        return f"{r.status_code}: {r.text[:80]}"
    except requests.RequestException as e:
        return type(e).__name__


def main():
    results = {}
    for label, extra in VARIANTS.items():
        subprocess.run(["docker", "rm", "-f", NAME], capture_output=True)
        subprocess.run(["docker", "run", "-d", "--name", NAME, "--network", "host", "-e", "CRATE_HEAP_SIZE=256m",
                        "--memory", "1g", IMAGE, *BASE, *extra], check=True, capture_output=True)
        for _ in range(90):
            if "Error" not in str(sql()):
                break
            time.sleep(1)
        results[label] = {
            "args": extra,
            "no credentials": sql(),
            "crate with a wrong password": sql("Basic Y3JhdGU6d3Jvbmc="),
        }
        print(label, results[label]["no credentials"], results[label]["crate with a wrong password"], flush=True)
    subprocess.run(["docker", "rm", "-f", NAME], capture_output=True)
    left = subprocess.run(["docker", "ps", "-a", "--filter", f"name={NAME}", "--format", "{{.Names}}"],
                          capture_output=True, text=True).stdout.split()
    results["remaining containers"] = left
    out = Path(__file__).resolve().parent / "results" / "argv-probe.json"
    out.write_text(json.dumps(results, indent=1) + "\n")


if __name__ == "__main__":
    main()
