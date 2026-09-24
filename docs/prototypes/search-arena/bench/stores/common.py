"""Shared settings for the local search-bench stores (Qdrant + CrateDB in Docker).

Connection details, collection / table names and the catalog reader used by both loaders.
"""
import gzip, json, os, subprocess, time

import httpx

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ARENA, "data")
RESULTS = os.path.join(ARENA, "results", "bench")
RESULT_FILE = os.path.join(RESULTS, "stores.json")

QDRANT_CONTAINER = "searchbench-qdrant"
QDRANT_URL = "http://127.0.0.1:16333"       # REST; gRPC on 127.0.0.1:16334
CRATE_CONTAINER = "searchbench-crate"
CRATE_URL = "http://127.0.0.1:14200"        # HTTP /_sql; PostgreSQL wire on 127.0.0.1:15432 (user crate, no password)

# One collection per vector storage variant. Named vectors and payload are identical; only text_en / text_multi differ.
VARIANTS = {
    "f32": "media_fingerprint_v1_f32",      # float32 text vectors
    "f16": "media_fingerprint_v1_f16",      # float16 text vectors (datatype: float16)
    "sq8": "media_fingerprint_v1_sq8",      # float32 text vectors + int8 scalar quantization, always_ram, rescore
}
# Reference only (not a candidate): production today, the fingerprint vector alone with the same payload and indexes.
BASE = ("base", "media_fingerprint_v1_base")
CRATE_TABLE = "doc.search_title"

EMB = {"text_en": ("emb-bge-base-en-v1.5-notitle.npy", 768), "text_multi": ("emb-multilingual-e5-small.npy", 384)}

DIMS = (
    "adrenaline tension scare violence romance eroticism wholesome wonder pathos melancholy uncanny catharsis "
    "nostalgia situational_comedy wit_wordplay physical_comedy cringe_humor absurdist_humor satire_parody dark_humor "
    "fantasy futuristic historical contemporary_realism crime mystery warfare political sports biographical "
    "coming_of_age family_dynamics psychological showbiz gaming pop_culture social_commentary class_and_capitalism "
    "technology_and_humanity spiritual narrative_structure dialogue_quality character_depth slow_burn fast_pace "
    "intrigue complexity rewatchability hopefulness bleakness ambiguity novelty homage_and_reference "
    "non_linear_narrative meta_narrative surrealism eccentricity philosophical educational direction acting "
    "cinematography editing music_composition world_immersion spectacle visual_stylization pastiche psychedelic "
    "grotesque camp_and_irony dialogue_centrality music_centrality sound_centrality"
).split()
assert len(DIMS) == 74

BOOL_FLAGS = [
    "is_anime",
    "suitability_adults", "suitability_date_night", "suitability_family", "suitability_friends",
    "suitability_group_party", "suitability_intergenerational", "suitability_kids", "suitability_partner",
    "suitability_public_viewing_safe", "suitability_solo_watch", "suitability_teens",
    "context_is_background_friendly", "context_is_binge_friendly", "context_is_comfort_watch",
    "context_is_drop_in_friendly", "context_is_pure_escapism", "context_is_thought_provoking",
]


def catalog():
    """Catalog rows in embedding row order (checked against emb-ids.json), people (creators / cast) merged in."""
    people = {}
    with gzip.open(os.path.join(DATA, "people.jsonl.gz"), "rt", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            people[r["id"]] = r
    rows = []
    with gzip.open(os.path.join(DATA, "catalog.jsonl.gz"), "rt", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            p = people.get(r["id"], {})
            r["creators"], r["cast"] = p.get("creators", []), p.get("cast", [])
            rows.append(r)
    ids = json.load(open(os.path.join(DATA, "emb-ids.json")))
    assert [r["id"] for r in rows] == ids, "catalog order differs from emb-ids.json"
    return rows


def docker_stats(container):
    """docker stats memory usage in bytes (cgroup usage as docker reports it) plus the raw string."""
    out = subprocess.run(["docker", "stats", "--no-stream", "--format", "{{.MemUsage}}", container],
                         capture_output=True, text=True, check=True).stdout.strip()
    used = out.split("/")[0].strip()
    return dict(docker_mem_usage=used, docker_mem_usage_bytes=_bytes(used))


def container_rss(container):
    """RSS of the container's largest process (VmRSS / RssAnon / RssFile from /proc/<pid>/status) plus the cgroup's
    anon / file memory (memory.stat), in bytes. Qdrant's PID 1 is its entrypoint shell, so the largest process is used."""
    script = ("for p in /proc/[0-9]*; do r=$(grep -E '^VmRSS' $p/status 2>/dev/null | awk '{print $2}'); "
              "[ -n \"$r\" ] && echo \"$r $(basename $p)\"; done | sort -n | tail -1")
    pid = subprocess.run(["docker", "exec", container, "sh", "-c", script], capture_output=True, text=True,
                         check=True).stdout.split()[1]
    out = subprocess.run(["docker", "exec", container, "grep", "-E", "VmRSS|RssAnon|RssFile", f"/proc/{pid}/status"],
                         capture_output=True, text=True, check=True).stdout
    vals = {}
    for line in out.splitlines():
        k, v = line.split(":")
        vals[k.strip()] = int(v.split()[0]) * 1024
    stat = subprocess.run(["docker", "exec", container, "cat", "/sys/fs/cgroup/memory.stat"], capture_output=True,
                          text=True, check=True).stdout
    cg = dict(line.split() for line in stat.splitlines())
    return dict(rss_bytes=vals.get("VmRSS"), rss_anon_bytes=vals.get("RssAnon"), rss_file_bytes=vals.get("RssFile"),
                cgroup_anon_bytes=int(cg["anon"]), cgroup_file_bytes=int(cg["file"]))


def smaps(container):
    """Resident bytes of the largest process by mapping: {collection: {component: bytes}} for Qdrant segment files
    (component = the segment sub-directory, e.g. vector_storage-text_en, payload_index), plus "anon" for anonymous
    memory (heap: jemalloc, quantized vectors kept in RAM, id trackers)."""
    script = ("p=$(for p in /proc/[0-9]*; do r=$(grep -E '^VmRSS' $p/status 2>/dev/null | awk '{print $2}'); "
              "[ -n \"$r\" ] && echo \"$r $p\"; done | sort -n | tail -1 | cut -d' ' -f2); "
              "awk '/^[0-9a-f]+-/{n=$6} /^Rss:/{r[n]+=$2} END{for(k in r) print r[k], k}' $p/smaps")
    out = subprocess.run(["docker", "exec", container, "sh", "-c", script], capture_output=True, text=True,
                         check=True).stdout
    res = {"anon": 0}
    for line in out.splitlines():
        kb, _, name = line.partition(" ")
        b = int(kb) * 1024
        if "/collections/" in name:
            parts = name.split("/collections/")[1].split("/")
            coll = parts[0]
            comp = parts[4] if len(parts) > 4 and parts[2] == "segments" else parts[2] if len(parts) > 2 else "other"
            res.setdefault(coll, {})
            res[coll][comp] = res[coll].get(comp, 0) + b
        elif not name.startswith("/"):
            res["anon"] += b
    return res


def du(container, path):
    """Allocated bytes on disk (du -sk; Qdrant preallocates sparse mmap files, so apparent size overstates it)."""
    out = subprocess.run(["docker", "exec", container, "du", "-sk", path], capture_output=True, text=True,
                         check=True).stdout
    return int(out.split()[0]) * 1024


def _bytes(s):
    units = {"B": 1, "KiB": 1024, "MiB": 1024 ** 2, "GiB": 1024 ** 3, "kB": 1000, "MB": 1000 ** 2, "GB": 1000 ** 3}
    for u in sorted(units, key=len, reverse=True):
        if s.endswith(u):
            return int(float(s[: -len(u)]) * units[u])
    return int(float(s))


def update_results(section, value):
    """Merge one top-level section into results/bench/stores.json."""
    os.makedirs(RESULTS, exist_ok=True)
    data = json.load(open(RESULT_FILE)) if os.path.exists(RESULT_FILE) else {}
    data[section] = value
    data["updated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(RESULT_FILE, "w") as f:
        json.dump(data, f, indent=2)


def client(base, timeout=600):
    return httpx.Client(base_url=base, timeout=timeout)
