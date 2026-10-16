"""Local proof of the #562 HBA plan on a disposable three-node CrateDB 5.10.16 cluster.

Run from the repository root, with the webapp's dependencies installed (cd goodwatch-webapp && npm ci):

    uv run --with requests --with 'psycopg[binary]' python docs/implementation/auth/cratedb-hba-lab/lab.py

Only a local Docker daemon is used. Every container and volume is named hba-*. The nodes use the host network and
bind only to 127.0.0.11-13: HTTP 16300, PostgreSQL wire protocol 16310, transport 16320. The run refuses to start
when an hba-* object exists, removes everything it created on exit, and checks that nothing is left. It writes
results/observations.json. No production endpoint or credential is used: the passwords are generated per run.

The users and grants come from grants.sql, the HBA rules from goodwatch-crate/docker-compose.yml as Compose renders
it, and the client is the webapp's goodwatch-webapp/app/utils/crate.ts. If the run is killed hard, cleanup.sh
removes what is left.
"""
import base64
import json
import os
import secrets
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg
import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
IMAGE = "crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307"
NODES = (1, 2, 3)
# Lab only: this Docker daemon caps open files at 20000 and the host keeps vm.max_map_count at 65530, so CrateDB's
# bootstrap checks fail for any node bound to a non-loopback address. The nodes therefore use the host network and
# bind to their own loopback address, which skips those checks. Clients connect from 127.0.0.1 (the kernel's source
# address on lo), so 127.0.0.1 plays the private network here. The administrative route connects from 127.0.0.99,
# which plays production's "127.0.0.1 inside the node's container".
IP = {n: f"127.0.0.1{n}" for n in NODES}  # mirrors 10.0.0.11-13
ADMIN_ADDRESS = "127.0.0.99"
NAME = {n: f"hba-crate-{n}" for n in NODES}
HTTP_PORT, PG_PORT, TRANSPORT_PORT = 16300, 16310, 16320
ENDPOINT = {n: f"http://{IP[n]}:{HTTP_PORT}" for n in NODES}
SNAPSHOTS = "hba-snapshots"
LABEL = "hba-lab=562"
OUTPUT = HERE / "results" / "observations.json"

report = {"startedAt": datetime.now(timezone.utc).isoformat(), "image": IMAGE, "checks": [], "failures": []}


def log(message):
    print(f"{datetime.now(timezone.utc):%H:%M:%S} {message}", flush=True)


def docker(*args, check=True, timeout=300):
    result = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"docker {' '.join(args[:3])}: {result.stderr.strip()}")
    return result.stdout.strip()


def owned():
    return {
        "containers": docker("ps", "-a", "--filter", "name=hba-", "--format", "{{.Names}}").split(),
        "networks": docker("network", "ls", "--filter", "name=hba-", "--format", "{{.Name}}").split(),
        "volumes": docker("volume", "ls", "--filter", "name=hba-", "--format", "{{.Name}}").split(),
    }


def check(label, actual, expected):
    ok = actual == expected
    report["checks"].append({"label": label, "actual": actual, "expected": expected, "ok": ok})
    log(("ok   " if ok else "FAIL ") + label + ("" if ok else f": {actual!r} != {expected!r}"))
    if not ok:
        report["failures"].append(label)
    return ok


# --- Node configuration ------------------------------------------------------------------------------------------

def base_args(n):
    """The production command of goodwatch-crate/docker-compose.yml, as Compose renders it, for this node."""
    return [
        "crate", "-Ccluster.name=hba-lab", f"-Cnode.name={NAME[n]}",
        # Production: -Cnetwork.host=0.0.0.0 -Cnetwork.publish_host=<10.0.0.x> -Ctransport.publish_port=4300
        f"-Cnetwork.host={IP[n]}", f"-Chttp.port={HTTP_PORT}", f"-Cpsql.port={PG_PORT}",
        f"-Ctransport.port={TRANSPORT_PORT}",
        "-Cdiscovery.seed_hosts=" + ",".join(f"{IP[m]}:{TRANSPORT_PORT}" for m in NODES),
        "-Ccluster.initial_master_nodes=" + ",".join(NAME[m] for m in NODES),
        "-Cgateway.expected_data_nodes=3", "-Cgateway.recover_after_data_nodes=3",
        "-Cpath.data=/data", "-Cpath.repo=/snapshots",
    ]


# Lab only: the shared Docker host's disk is over CrateDB's default 85/90 % watermarks, which would leave replicas
# unassigned. Allocation then ignores disk usage. Authentication is unaffected.
LAB_ONLY = ["-Ccluster.routing.allocation.disk.threshold_enabled=false"]

# Today's rules, including the comment that Compose passes on as four arguments. HBA is off. (Production's
# address 127.0.0.1 is ADMIN_ADDRESS here.)
PRODUCTION_HBA = [
    "#", "host-based", "auth", "map",
    "-Cauth.host_based.config.0.user=crate",
    f"-Cauth.host_based.config.0.address={ADMIN_ADDRESS}",
    "-Cauth.host_based.config.0.method=trust",
    "-Cauth.host_based.config.1.method=password",
]

# Only the switch flipped: what a naive fix would deploy.
NAIVE_HBA = PRODUCTION_HBA + ["-Cauth.host_based.enabled=true"]


def compose_hba(enabled):
    """The HBA arguments of goodwatch-crate/docker-compose.yml as Compose renders them, with the lab's admin address.

    This is the committed production configuration, not a copy of it."""
    environ = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "DOCKER_HOST")}
    environ |= {"CRATE_VERSION": "5.10.16", "NODE_NAME": "crate-01", "SELF_IP": "10.0.0.11", "HEAP_SIZE": "1g",
                "CLUSTER_NAME": "c", "SEED_HOSTS": "a", "MASTER_NODES": "a", "EXPECTED_NODES": "3"}
    if enabled:
        environ["CRATE_HBA_ENABLED"] = "true"
    rendered = subprocess.run(
        ["docker", "compose", "-f", str(ROOT / "goodwatch-crate" / "docker-compose.yml"), "-p", "hba-render",
         "config", "--format", "json"], env=environ, capture_output=True, text=True, check=True).stdout
    command = json.loads(rendered)["services"]["cratedb"]["command"]
    hba = command[next(i for i, arg in enumerate(command) if arg.startswith("-Cauth.host_based.enabled=")):]
    assert all(arg.startswith("-Cauth.host_based.") for arg in hba), hba
    return [arg.replace("address=127.0.0.1", f"address={ADMIN_ADDRESS}") for arg in hba]


COMPOSE_HBA_OFF, PLANNED_HBA = compose_hba(False), compose_hba(True)


def start(n, hba):
    docker(
        "run", "-d", "--name", NAME[n], "--label", LABEL, "--network", "host",
        "-v", f"hba-crate-{n}-data:/data", "-v", f"{SNAPSHOTS}:/snapshots",
        "-e", "CRATE_HEAP_SIZE=512m", "--memory", "1536m", "--restart", "no",
        IMAGE, *base_args(n), *LAB_ONLY, *hba,
    )


def replace(n, hba):
    docker("stop", "-t", "60", NAME[n], timeout=120)
    docker("rm", NAME[n])
    start(n, hba)


# --- SQL -----------------------------------------------------------------------------------------------------------

def admin(n, stmt, args=None):
    """The administrative route: `crate` from 127.0.0.1 inside the node's container, with no password."""
    body = json.dumps({"stmt": stmt, "args": args or []})
    out = docker("exec", NAME[n], "curl", "-sS", "-m", "60", "--interface", ADMIN_ADDRESS,
                 "-H", "Content-Type: application/json", f"{ENDPOINT[n]}/_sql", "-d", body, check=False, timeout=90)
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"error": {"message": out[:300]}}


def admin_ok(n, stmt, args=None):
    result = admin(n, stmt, args)
    if "error" in result:
        raise RuntimeError(f"{stmt[:60]}: {result['error']}")
    return result


def http(n, stmt, args=None, auth=None, header=None):
    headers = {"Content-Type": "application/json"}
    if header is not None:
        headers["Authorization"] = header
    elif auth is not None:
        user, password = auth
        headers["Authorization"] = "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()
    try:
        response = requests.post(f"{ENDPOINT[n]}/_sql", json={"stmt": stmt, "args": args or []},
                                 headers=headers, timeout=60)
    except requests.RequestException as e:
        return 0, {"error": {"message": type(e).__name__}}
    try:
        return response.status_code, response.json()
    except ValueError:
        return response.status_code, {"error": {"message": response.text[:200]}}


def outcome(status, body):
    """'ok', or the HTTP status with Crate's error code."""
    if status == 200 and "error" not in body:
        return "ok"
    return f"{status}/{body.get('error', {}).get('code')}"


def current_user(n, auth=None, header=None):
    status, body = http(n, "SELECT current_user", auth=auth, header=header)
    return body["rows"][0][0] if status == 200 and "rows" in body else outcome(status, body)


def wait_healthy(label, timeout=240):
    end, last = time.monotonic() + timeout, None
    while time.monotonic() < end:
        for n in NODES:
            try:
                nodes = admin(n, "SELECT count(*) FROM sys.nodes")
                health = admin(n, "SELECT count(*) FROM sys.health WHERE health <> 'GREEN'")
                shards = admin(n, "SELECT count(*) FROM sys.shards WHERE state <> 'STARTED' OR routing_state <> 'STARTED'")
                if all("rows" in r for r in (nodes, health, shards)):
                    last = (nodes["rows"][0][0], health["rows"][0][0], shards["rows"][0][0])
                    if last == (3, 0, 0):
                        log(f"{label}: 3 nodes, every table GREEN, every shard STARTED")
                        return True
                    break
            except Exception as e:  # node still starting
                last = str(e)
        time.sleep(2)
    log(f"{label}: not healthy after {timeout}s, last {last}")
    return False


# --- Data and users ------------------------------------------------------------------------------------------------

SCHEMA = [
    "CREATE TABLE doc.movies (tmdb_id INT PRIMARY KEY, title TEXT) CLUSTERED INTO 3 SHARDS WITH (number_of_replicas = 2)",
    "CREATE TABLE doc.user_score (user_id TEXT, tmdb_id INT, score INT, PRIMARY KEY (user_id, tmdb_id)) "
    "CLUSTERED INTO 3 SHARDS WITH (number_of_replicas = 2)",
    "CREATE TABLE doc.user_setting (user_id TEXT, key TEXT, value TEXT, created_at TIMESTAMP WITH TIME ZONE, "
    "updated_at TIMESTAMP WITH TIME ZONE, PRIMARY KEY (user_id, key)) CLUSTERED INTO 3 SHARDS "
    "WITH (number_of_replicas = 2, \"write.wait_for_active_shards\" = 1)",
    "CREATE TABLE doc.search_interpretations (id TEXT PRIMARY KEY, body TEXT) WITH (number_of_replicas = 2)",
    "CREATE TABLE doc.search_spending (id TEXT PRIMARY KEY, cents INT) WITH (number_of_replicas = 2)",
    "CREATE TABLE doc.search_control (id TEXT PRIMARY KEY, paused BOOLEAN) WITH (number_of_replicas = 2)",
    "CREATE TABLE doc.search_index_builds (build_id TEXT PRIMARY KEY, manifest TEXT) WITH (number_of_replicas = 2)",
    "CREATE TABLE doc.workflow_monitoring (key TEXT PRIMARY KEY, payload TEXT) WITH (number_of_replicas = 2)",
    "CREATE TABLE doc.auth_user (id TEXT PRIMARY KEY, email TEXT) WITH (number_of_replicas = 2)",
    "CREATE BLOB TABLE search_index_files CLUSTERED INTO 3 SHARDS WITH (number_of_replicas = 2)",
    "INSERT INTO doc.movies (tmdb_id, title) VALUES (603, 'The Matrix'), (550, 'Fight Club')",
    "INSERT INTO doc.search_index_builds (build_id, manifest) VALUES ('current', '{}')",
    "INSERT INTO doc.auth_user (id, email) VALUES ('u1', 'member@example.invalid')",
    "REFRESH TABLE doc.movies, doc.search_index_builds, doc.auth_user",
    "CREATE REPOSITORY lab_repo TYPE fs WITH (location = '/snapshots/v2')",
]


def grant_statements():
    statements, current = [], []
    for line in (HERE / "grants.sql").read_text().splitlines():
        line = line.split("--", 1)[0].strip()
        if not line:
            continue
        current.append(line)
        if line.endswith(";"):
            statements.append(" ".join(current)[:-1])
            current = []
    return statements


USERS = ["goodwatch_webapp", "goodwatch_search", "goodwatch_windmill", "goodwatch_auth", "goodwatch_readonly",
         "goodwatch_backup"]


def make_passwords():
    # URL characters in every password: the clients must send them unchanged.
    return {user: "p@ss:#/?" + secrets.token_urlsafe(18) for user in USERS}


def create_users(passwords):
    for stmt in grant_statements():
        args = None
        if stmt.startswith("CREATE USER"):
            args = [passwords[stmt.split()[2]]]
        admin_ok(1, stmt, args)
    report["grants"] = admin_ok(1, "SELECT grantee, class, ident, type, state FROM sys.privileges "
                                   "WHERE grantee LIKE 'goodwatch_%' ORDER BY 1, 2, 3, 4")["rows"]


def blob(n, method, digest, auth, data=None):
    headers = {}
    if auth:
        headers["Authorization"] = "Basic " + base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
    url = f"{ENDPOINT[n]}/_blobs/search_index_files/{digest}"
    try:
        response = requests.request(method, url, data=data, headers=headers, timeout=30, allow_redirects=False)
    except requests.RequestException as e:
        return type(e).__name__
    # A node without the blob redirects to one that has it (inside the lab network).
    return "ok" if response.status_code in (200, 201, 307) else str(response.status_code)


# Each client's job, and what it must not do. Expected: "ok" or "denied".
JOBS = {
    "goodwatch_webapp": [
        ("SELECT title FROM doc.movies WHERE tmdb_id = 603", "ok"),
        ("SELECT table_name FROM information_schema.tables WHERE table_name = 'movies'", "ok"),
        ("INSERT INTO doc.user_score (user_id, tmdb_id, score) VALUES ('w', 603, 9) "
         "ON CONFLICT (user_id, tmdb_id) DO UPDATE SET score = excluded.score", "ok"),
        ("REFRESH TABLE doc.user_score", "ok"),
        ("UPDATE doc.user_score SET score = 8 WHERE user_id = 'w'", "ok"),
        ("DELETE FROM doc.user_score WHERE user_id = 'w'", "ok"),
        ("SELECT email FROM doc.auth_user", "denied"),
        ("INSERT INTO doc.auth_user (id, email) VALUES ('x', 'x')", "denied"),
        ("CREATE TABLE doc.webapp_made (id INT)", "denied"),
        ("DROP TABLE doc.user_score", "denied"),
        ("ALTER TABLE doc.movies ADD COLUMN extra TEXT", "denied"),
        ("CREATE USER intruder", "denied"),
        ("GRANT AL TO goodwatch_webapp", "denied"),
        ("CREATE SNAPSHOT lab_repo.webapp_snap ALL WITH (wait_for_completion = true)", "denied"),
        ("SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'all'", "denied"),
    ],
    "goodwatch_search": [
        ("SELECT title FROM doc.movies", "ok"),
        ("SELECT manifest FROM doc.search_index_builds WHERE build_id = 'current'", "ok"),
        ("INSERT INTO doc.search_interpretations (id, body) VALUES ('s', 'b')", "ok"),
        ("INSERT INTO doc.search_spending (id, cents) VALUES ('s', 1) "
         "ON CONFLICT (id) DO UPDATE SET cents = excluded.cents", "ok"),
        ("INSERT INTO doc.search_control (id, paused) VALUES ('s', false) "
         "ON CONFLICT (id) DO UPDATE SET paused = excluded.paused", "ok"),
        ("DELETE FROM doc.search_interpretations WHERE id = 's'", "ok"),
        ("INSERT INTO doc.user_score (user_id, tmdb_id, score) VALUES ('s', 1, 1)", "denied"),
        ("UPDATE doc.movies SET title = 'x' WHERE tmdb_id = 603", "denied"),
        ("SELECT email FROM doc.auth_user", "denied"),
        ("CREATE TABLE doc.search_made (id INT)", "denied"),
        ("CREATE USER intruder", "denied"),
    ],
    "goodwatch_windmill": [
        ("CREATE TABLE IF NOT EXISTS doc.windmill_made (id INT PRIMARY KEY, v TEXT)", "ok"),
        ("ALTER TABLE doc.windmill_made ADD COLUMN extra TEXT", "ok"),
        ("INSERT INTO doc.windmill_made (id, v) VALUES (1, 'a') ON CONFLICT (id) DO UPDATE SET v = excluded.v", "ok"),
        ("REFRESH TABLE doc.windmill_made", "ok"),
        ("SELECT count(*) FROM doc.movies", "ok"),
        ("INSERT INTO doc.workflow_monitoring (key, payload) VALUES ('k', 'p') "
         "ON CONFLICT (key) DO UPDATE SET payload = excluded.payload", "ok"),
        ("SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc'", "ok"),
        ("SELECT count(*) FROM information_schema.columns WHERE table_name = 'movies'", "ok"),
        ("SELECT name FROM sys.nodes", "ok"),
        ("SELECT settings['cluster']['routing']['allocation']['enable'] FROM sys.cluster", "ok"),
        ("SELECT count(*) FROM sys.shards", "ok"),
        ("SELECT name, state, finished FROM sys.snapshots WHERE repository = 'lab_repo'", "ok"),
        ("CREATE BLOB TABLE windmill_blobs WITH (number_of_replicas = 0)", "ok"),
        ("DROP BLOB TABLE windmill_blobs", "ok"),
        ("DROP TABLE doc.windmill_made", "ok"),
        ("SELECT email FROM doc.auth_user", "denied"),
        ("DELETE FROM doc.auth_user", "denied"),
        ("DROP TABLE doc.auth_user", "denied"),
        ("CREATE USER intruder", "denied"),
        ("GRANT AL TO goodwatch_windmill", "denied"),
        ("CREATE SNAPSHOT lab_repo.windmill_snap ALL WITH (wait_for_completion = true)", "denied"),
        ("SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'all'", "denied"),
    ],
    "goodwatch_auth": [
        ("SELECT email FROM doc.auth_user WHERE id = 'u1'", "ok"),
        ("INSERT INTO doc.auth_user (id, email) VALUES ('u2', 'second@example.invalid')", "ok"),
        ("UPDATE doc.auth_user SET email = 'changed@example.invalid' WHERE id = 'u2'", "ok"),
        ("REFRESH TABLE doc.auth_user", "ok"),
        ("DELETE FROM doc.auth_user WHERE id = 'u2'", "ok"),
        ("SELECT title FROM doc.movies", "denied"),
        ("INSERT INTO doc.user_score (user_id, tmdb_id, score) VALUES ('a', 1, 1)", "denied"),
        ("CREATE TABLE doc.auth_made (id INT)", "denied"),
        ("DROP TABLE doc.auth_user", "denied"),
        ("CREATE USER intruder", "denied"),
    ],
    "goodwatch_readonly": [
        ("SELECT title FROM doc.movies", "ok"),
        ("SELECT count(*) FROM doc.user_score", "ok"),
        ("INSERT INTO doc.user_score (user_id, tmdb_id, score) VALUES ('r', 1, 1)", "denied"),
        ("SELECT email FROM doc.auth_user", "denied"),
        ("CREATE TABLE doc.readonly_made (id INT)", "denied"),
        ("CREATE USER intruder", "denied"),
    ],
    "goodwatch_backup": [
        ("CREATE SNAPSHOT lab_repo.hourly_lab ALL WITH (wait_for_completion = true)", "ok"),
        ("SELECT name, state, finished FROM sys.snapshots WHERE repository = 'lab_repo'", "ok"),
        ("DROP SNAPSHOT lab_repo.hourly_lab", "ok"),
        ("SELECT title FROM doc.movies", "denied"),
        ("DROP TABLE doc.movies", "denied"),
        ("DELETE FROM doc.user_score", "denied"),
        ("CREATE TABLE doc.backup_made (id INT)", "denied"),
        ("DROP BLOB TABLE search_index_files", "denied"),
        ("CREATE USER intruder", "denied"),
        ("GRANT AL TO goodwatch_backup", "denied"),
        ("SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'all'", "denied"),
    ],
}


def run_jobs(n, passwords, label):
    results = {}
    for user, jobs in JOBS.items():
        for stmt, expected in jobs:
            got = outcome(*http(n, stmt, auth=(user, passwords[user])))
            # 401 is a missing privilege; 404 is an object hidden from this user. Anything else is a real error.
            kind = "ok" if got == "ok" else "denied" if got.split("/")[0] in ("401", "403", "404") else got
            check(f"{label} {user}: {expected:6} {stmt[:70]}", kind, expected)
            results.setdefault(user, []).append({"stmt": stmt, "expected": expected, "outcome": got})
    import hashlib
    body = f"lab index file {label}".encode()
    digest = hashlib.sha1(body).hexdigest()
    other = f"auth's file {label}".encode()
    windmill, search = ("goodwatch_windmill", passwords["goodwatch_windmill"]), ("goodwatch_search", passwords["goodwatch_search"])
    results["blobs"] = {
        "windmill PUT": blob(n, "PUT", digest, windmill, body),
        "auth PUT": blob(n, "PUT", hashlib.sha1(other).hexdigest(), ("goodwatch_auth", passwords["goodwatch_auth"]), other),
        "no credentials PUT": blob(n, "PUT", hashlib.sha1(other + b"x").hexdigest(), None, other + b"x"),
        "search GET": blob(n, "GET", digest, search),
        "webapp GET": blob(n, "GET", digest, ("goodwatch_webapp", passwords["goodwatch_webapp"])),
        "auth GET": blob(n, "GET", digest, ("goodwatch_auth", passwords["goodwatch_auth"])),
        "no credentials GET": blob(n, "GET", digest, None),
        "wrong password GET": blob(n, "GET", digest, ("goodwatch_search", "wrong")),
    }
    return results


# --- Authentication matrix -----------------------------------------------------------------------------------------

def auth_matrix(n, passwords):
    cases = {
        "no credentials": current_user(n),
        "crate, no password": current_user(n, auth=("crate", "")),
        "crate, any password": current_user(n, auth=("crate", "guess")),
        "goodwatch_webapp, wrong password": current_user(n, auth=("goodwatch_webapp", "wrong")),
        "goodwatch_webapp, empty password": current_user(n, auth=("goodwatch_webapp", "")),
        "unknown user": current_user(n, auth=("nobody", "x")),
        "empty user (Basic Og==)": current_user(n, header="Basic Og=="),
    }
    for user in USERS:
        cases[f"{user}, its password"] = current_user(n, auth=(user, passwords[user]))
    return cases


def pg_user(n, user, password):
    try:
        with psycopg.connect(host=IP[n], port=PG_PORT, user=user, password=password, dbname="doc",
                             connect_timeout=10, sslmode="disable") as con:
            return con.execute("SELECT current_user").fetchone()[0]
    except Exception as e:
        return "refused: " + type(e).__name__


def pg_matrix(n, passwords):
    return {
        "crate, no password": pg_user(n, "crate", None),
        "goodwatch_readonly, wrong password": pg_user(n, "goodwatch_readonly", "wrong"),
        "goodwatch_readonly, its password": pg_user(n, "goodwatch_readonly", passwords["goodwatch_readonly"]),
    }


def expect_enforced(n, passwords, label):
    cases = auth_matrix(n, passwords)
    for case, got in cases.items():
        if case.endswith("its password"):
            check(f"{label} node {n} http: {case}", got, case.split(",")[0])
        else:
            check(f"{label} node {n} http: {case} is rejected", str(got).startswith("401"), True)
    pg = pg_matrix(n, passwords)
    check(f"{label} node {n} pg: crate without password is rejected", pg["crate, no password"].startswith("refused"), True)
    check(f"{label} node {n} pg: wrong password is rejected", pg["goodwatch_readonly, wrong password"].startswith("refused"), True)
    check(f"{label} node {n} pg: correct password", pg["goodwatch_readonly, its password"], "goodwatch_readonly")
    check(f"{label} node {n} admin route", admin(n, "SELECT current_user").get("rows"), [["crate"]])
    return {"http": cases, "pg": pg}


# --- Failover with the webapp wrapper ------------------------------------------------------------------------------

def verify_script(passwords):
    """The production verification script (../verify_crate_endpoints.py) against the lab nodes."""
    env = dict(os.environ, CRATE_HOSTS=",".join(IP[n] for n in NODES), CRATE_PORT=str(HTTP_PORT),
               CRATE_USER="goodwatch_webapp", CRATE_PASS=passwords["goodwatch_webapp"])
    run = subprocess.run([sys.executable, str(HERE.parent / "verify_crate_endpoints.py")], env=env,
                         capture_output=True, text=True, timeout=120)
    if passwords["goodwatch_webapp"] in run.stdout + run.stderr:
        report["failures"].append("verify_crate_endpoints.py printed a password")
    return {"exit": run.returncode, "lines": [json.loads(line) for line in run.stdout.splitlines()]}


def failover(passwords, action):
    env = dict(os.environ, CRATE_HOSTS=",".join(IP[n] for n in NODES), CRATE_PORT=str(HTTP_PORT),
               CRATE_USER="goodwatch_webapp", CRATE_PASS=passwords["goodwatch_webapp"], CRATE_TIMEOUT_MS="10000")
    process = subprocess.Popen(["node", str(HERE / "failover.mjs")], cwd=ROOT / "goodwatch-webapp", env=env,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    assert process.stdout.readline().strip() == "ready"
    time.sleep(3)
    started = time.monotonic()
    # Watch node 2 directly with valid credentials: what does it answer while it comes back?
    watch = {"stop": False, "answers": []}

    def watcher():
        while not watch["stop"]:
            status, body = http(2, "SELECT 1", auth=("goodwatch_webapp", passwords["goodwatch_webapp"]))
            text = "ok" if status == 200 else f"{status} {str(body.get('error', {}).get('message', ''))[:60]}"
            if not watch["answers"] or watch["answers"][-1]["answer"] != text:
                watch["answers"].append({"atSeconds": round(time.monotonic() - started, 2), "answer": text, "count": 0})
            watch["answers"][-1]["count"] += 1
            time.sleep(0.05)

    import threading
    thread = threading.Thread(target=watcher, daemon=True)
    thread.start()
    if action == "restart":
        docker("restart", "-t", "30", NAME[2], timeout=120)
    else:
        docker("kill", NAME[2])
        time.sleep(10)
        docker("start", NAME[2])
    log(f"node 2 {action}: docker returned after {time.monotonic() - started:.1f}s")
    healthy = wait_healthy(f"after node 2 {action}")
    time.sleep(3)
    process.stdin.write("stop\n")
    process.stdin.flush()
    result = json.loads(process.stdout.read())
    process.wait(timeout=60)
    result["recoveredGreen"] = healthy
    watch["stop"] = True
    thread.join(timeout=30)
    result["node2DirectAnswers"] = watch["answers"]
    log(f"{action}: {json.dumps({k: v for k, v in result.items() if k != 'errors'})}")
    check(f"failover {action}: reads failed", result["reads"]["failed"], 0)
    check(f"failover {action}: upserts failed", result["upserts"]["failed"], 0)
    check(f"failover {action}: every request carried goodwatch_webapp",
          result["currentUser"], ["goodwatch_webapp"])
    check(f"failover {action}: cluster recovered GREEN", healthy, True)
    return result


# --- Run ----------------------------------------------------------------------------------------------------------

def cleanup():
    for n in NODES:
        docker("rm", "-f", "-v", NAME[n], check=False)
    for n in NODES:
        docker("volume", "rm", f"hba-crate-{n}-data", check=False)
    docker("volume", "rm", SNAPSHOTS, check=False)
    left = owned()
    report["cleanup"] = {"at": datetime.now(timezone.utc).isoformat(), "remaining": left}
    log(f"cleanup: remaining hba-* objects {left}")


def main():
    signal.signal(signal.SIGTERM, lambda *_: sys.exit("terminated"))
    host = os.environ.get("DOCKER_HOST", "unix:///var/run/docker.sock")
    if not host.startswith("unix://") or os.environ.get("DOCKER_CONTEXT"):
        sys.exit("Only a local Unix Docker socket is allowed")
    if any(owned().values()):
        sys.exit(f"hba-* objects exist already: {owned()}")
    passwords = make_passwords()
    try:
        docker("volume", "create", "--label", LABEL, SNAPSHOTS)
        docker("run", "--rm", "--name", "hba-chown", "-v", f"{SNAPSHOTS}:/snapshots", "--entrypoint", "chown",
               IMAGE, "1000:1000", "/snapshots")
        for n in NODES:
            docker("volume", "create", "--label", LABEL, f"hba-crate-{n}-data")
            start(n, PRODUCTION_HBA)
        assert wait_healthy("production command, HBA off")
        report["versions"] = admin_ok(1, "SELECT name, version['number'] FROM sys.nodes ORDER BY name")["rows"]
        report["productionCommandArgs"] = json.loads(docker("inspect", NAME[1], "--format", "{{json .Args}}"))

        # 1. Today's behaviour: everything is `crate`.
        today = {n: {"no credentials": current_user(n), "crate, wrong password": current_user(n, auth=("crate", "x"))}
                 for n in NODES}
        report["hbaOff"] = today
        for n in NODES:
            check(f"HBA off node {n}: no credentials act as crate", today[n]["no credentials"], "crate")
            check(f"HBA off node {n}: wrong password accepted as crate", today[n]["crate, wrong password"], "crate")

        # 2. Users and grants while HBA is still off: the credentials-first step.
        for stmt in SCHEMA:
            admin_ok(1, stmt)
        create_users(passwords)
        pause = os.environ.get("HBA_LAB_PAUSE_FILE")
        if pause:  # exploration: keep the cluster with HBA off until the file is removed
            Path(pause).touch()
            log(f"paused until {pause} is removed")
            while Path(pause).exists():
                time.sleep(2)
        assert wait_healthy("schema and users")
        report["credentialsFirst"] = {
            "jobs": run_jobs(1, passwords, "HBA off, node 1"),
            "wrong password still accepted": current_user(1, auth=("goodwatch_webapp", "wrong")),
        }
        check("HBA off: a wrong password for goodwatch_webapp is still accepted, as that user",
              report["credentialsFirst"]["wrong password still accepted"], "goodwatch_webapp")

        # 3. The naive switch on one node.
        log("naive: node 3 with today's rules and auth.host_based.enabled=true")
        replace(3, NAIVE_HBA)
        naive_healthy = wait_healthy("naive HBA on node 3", timeout=120)
        # The finding: every -C after the "#" token is dropped, so the switch never takes effect.
        report["naiveEnforcement"] = auth_matrix(3, passwords)
        check("naive HBA node 3: still no enforcement, no credentials act as crate",
              report["naiveEnforcement"]["no credentials"], "crate")
        check("naive HBA node 3: still no enforcement, a wrong password is accepted",
              report["naiveEnforcement"]["goodwatch_webapp, wrong password"], "goodwatch_webapp")
        logged = subprocess.run(["docker", "logs", "--tail", "400", NAME[3]], capture_output=True, text=True)
        report["naive"] = {
            "rejoinedGreenWithin120s": naive_healthy,
            "nodesSeenFromNode1": admin(1, "SELECT name FROM sys.nodes ORDER BY name").get("rows"),
            "node3Log": [line[:400] for line in (logged.stdout + logged.stderr).splitlines()
                         if any(k in line for k in ("uthenticat", "HBA", "host_based", "rejected", "denied"))][-12:],
        }
        if not naive_healthy:
            log("naive: node 3 did not rejoin; restoring today's command")
        replace(3, PRODUCTION_HBA)
        assert wait_healthy("node 3 back on today's command")

        # 4. The merged compose file with CRATE_HBA_ENABLED unset changes nothing: node 1 on it, HBA still off.
        replace(1, COMPOSE_HBA_OFF)
        check("compose default node 1: cluster GREEN", wait_healthy("node 1 on the new compose file, HBA off"), True)
        report["composeDefault"] = {"args": COMPOSE_HBA_OFF, "no credentials": current_user(1),
                                    "wrong password": current_user(1, auth=("goodwatch_webapp", "wrong"))}
        check("compose default node 1: no credentials still act as crate", report["composeDefault"]["no credentials"], "crate")
        check("compose default node 1: a wrong password is still accepted",
              report["composeDefault"]["wrong password"], "goodwatch_webapp")

        # 5. The rollout, one node at a time: the compose file with CRATE_HBA_ENABLED=true.
        report["rollout"] = []
        for n in NODES:
            log(f"rollout: node {n} gets the planned HBA rules")
            replace(n, PLANNED_HBA)
            healthy = wait_healthy(f"node {n} with HBA")
            check(f"rollout node {n}: cluster GREEN with 3 nodes", healthy, True)
            step = {"node": n, "healthy": healthy, "enforcedHere": expect_enforced(n, passwords, f"rollout step {n}:")}
            others = [m for m in NODES if m > n]
            step["stillOpen"] = {m: current_user(m) for m in others}
            for m in others:
                check(f"rollout step {n}: node {m} still has HBA off", step["stillOpen"][m], "crate")
            step["verifyScript"] = verify_script(passwords)
            check(f"rollout step {n}: verify_crate_endpoints.py passes only once every node enforces",
                  step["verifyScript"]["exit"], 0 if n == 3 else 1)
            report["rollout"].append(step)

        # 6. Final state: every node enforces, every client does its job and nothing more.
        report["final"] = {n: expect_enforced(n, passwords, "final:") for n in NODES}

        report["finalJobs"] = {n: run_jobs(n, passwords, f"final node {n}") for n in NODES}

        # 7. The webapp wrapper with credentials, through a node restart and a node kill.
        report["failover"] = {action: failover(passwords, action) for action in ("restart", "kill")}
        report["hbaRules"] = PLANNED_HBA
    except Exception as e:
        report["failures"].append(f"aborted: {type(e).__name__}: {e}")
        log(f"ABORTED: {e}")
    finally:
        cleanup()
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        OUTPUT.parent.mkdir(exist_ok=True)
        OUTPUT.write_text(json.dumps(report, indent=1, default=str) + "\n")
    passed = sum(c["ok"] for c in report["checks"])
    log(f"{passed} of {len(report['checks'])} checks passed; failures: {report['failures']}")
    return 1 if report["failures"] or any(report["cleanup"]["remaining"].values()) else 0


if __name__ == "__main__":
    sys.exit(main())
