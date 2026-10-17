"""Run through `ssh root@10.0.0.20 python3 - < check-search-readiness.py`.

Read Docker metadata and built files; issue anonymous loopback requests only.
Environment values never leave this process: output names, presence and hash equality.
Does not import the auth runtime or call authenticated endpoints.
"""

import datetime
import hashlib
import json
import subprocess


def docker_json(*args):
    return json.loads(subprocess.check_output(["docker", *args]))[0]


def env_of(container):
    return dict(item.split("=", 1) for item in container["Config"]["Env"] if "=" in item)


def fingerprint(value):
    return hashlib.sha256(value.encode()).digest() if value is not None else None


required = [
    "BETTER_AUTH_ENABLED", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL",
    "AUTH_CRATEDB_ORIGINS", "AUTH_CRATEDB_USERNAME", "AUTH_CRATEDB_PASSWORD",
    "AUTH_CRATEDB_ENCRYPTION_SECRET", "AUTH_CRATEDB_ENCRYPTION_KEYS",
    "AUTH_TRUSTED_IP_HEADER", "AUTH_GOOGLE_CLIENT_ID", "AUTH_GOOGLE_CLIENT_SECRET",
    "AUTH_SMTP_USER", "AUTH_SMTP_PASSWORD", "MCP_RESOURCE_URL",
]
shared = [
    "REDIS_HOST", "REDIS_HOST2", "REDIS_HOST3", "REDIS_PORT", "REDIS_PASS",
    "SEARCH_STORAGE_KEY", "CRATE_HOSTS", "CRATE_PORT", "CRATE_USER", "CRATE_PASS",
]
pages = subprocess.check_output([
    "docker", "ps", "--filter", "name=^gk4owk8-", "--format", "{{.Names}}",
], text=True).splitlines()
if len(pages) != 1:
    raise SystemExit("Expected exactly one running page container; rerun after the deploy settles")
page = docker_json("inspect", pages[0])
page_env = env_of(page)
report = {
    "checked_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "host": "vector1 (10.0.0.20)",
    "page_container": pages[0],
    "page_image": page["Config"]["Image"],
    "roles": [],
}
for name in ["goodwatch-search-a", "goodwatch-search-b"]:
    container = docker_json("inspect", name)
    image = docker_json("image", "inspect", container["Image"])
    env = env_of(container)
    labels = container["Config"].get("Labels") or {}
    result = {
        "container": name,
        "declared_image": container["Config"]["Image"],
        "image_id": container["Image"],
        "image_repo_tags": image.get("RepoTags"),
        "image_repo_digests": image.get("RepoDigests"),
        "oci_revision": (image["Config"].get("Labels") or {}).get("org.opencontainers.image.revision"),
        "created": container["Created"],
        "health": container["State"].get("Health", {}).get("Status"),
        "compose_project": labels.get("com.docker.compose.project"),
        "compose_service": labels.get("com.docker.compose.service"),
        "compose_config_files": labels.get("com.docker.compose.project.config_files"),
        "role_is_search": fingerprint(env.get("WEBAPP_ROLE")) == fingerprint("search"),
        "source_matches_search_commit": fingerprint(env.get("SOURCE_COMMIT")) == fingerprint(env.get("SEARCH_COMMIT")),
        "search_commit_matches_declared_image_tag": fingerprint(env.get("SEARCH_COMMIT")) == fingerprint(container["Config"]["Image"].rsplit(":", 1)[-1]),
        "environment_names": sorted(env),
        "required_environment_present": {key: bool(env.get(key)) for key in required},
        "required_environment_present_on_page": {key: bool(page_env.get(key)) for key in required},
        "shared_environment_hash_matches_page": {
            key: bool(env.get(key)) and fingerprint(env.get(key)) == fingerprint(page_env.get(key))
            for key in shared
        },
    }
    scan = r"""const fs=require('fs'),path=require('path');let files=[];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){
 const q=path.join(p,e.name);if(e.isDirectory())walk(q);else if(/\.(js|json)$/.test(q))files.push(q)}}
walk('/app/build/server');let out={};
for(const term of ['routes/mcp','MCP_RESOURCE_URL','BETTER_AUTH_ENABLED','verifyAccessToken','AUTH_CRATEDB_ORIGINS'])
 out[term]=files.filter(f=>fs.readFileSync(f,'utf8').includes(term));
console.log(JSON.stringify(out));"""
    result["built_code_matches"] = json.loads(subprocess.check_output([
        "docker", "exec", name, "node", "-e", scan,
    ], text=True))
    result["anonymous_loopback_probes"] = []
    for endpoint, method in [("/mcp", "POST"), ("/health/ready", "GET")]:
        probe = """fetch('http://127.0.0.1:3000'+%s,{
method:%s,headers:{Host:'goodwatch.app','Content-Type':'application/json'},
%s signal:AbortSignal.timeout(8000)}).then(r=>console.log(JSON.stringify({
path:%s,status:r.status,www_authenticate:r.headers.get('www-authenticate')
}))).catch(e=>{console.log(JSON.stringify({error:e.name}));process.exitCode=1})""" % (
            json.dumps(endpoint), json.dumps(method), "body:'{}'," if method == "POST" else "", json.dumps(endpoint),
        )
        result["anonymous_loopback_probes"].append(json.loads(subprocess.check_output([
            "docker", "exec", name, "node", "-e", probe,
        ], text=True)))
    report["roles"].append(result)
print(json.dumps(report, indent=2))
