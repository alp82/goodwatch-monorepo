"""Explicit offline pack check and benchmark; never imports a database connector.

Run with --research pointing at taste-loop's lab, --pack at the open pack, and
--scratch at ~/goodwatch-research/taste/work/g1-job. --write-fixtures refreshes
the small public-title/component fixture, with no member ids or member rows.
"""
import argparse
import importlib.util
import json
import os
import resource
import sys
import time
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from unittest.mock import patch

os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"
os.environ["NUMEXPR_NUM_THREADS"] = "2"
sys.dont_write_bytecode = True

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.sync.copy import g1_order as job


def equal_arrays(a, b):
    if isinstance(a, dict):
        assert a.keys() == b.keys(), (a.keys(), b.keys())
        for k in a:
            equal_arrays(a[k], b[k])
    elif isinstance(a, np.ndarray):
        assert a.dtype == b.dtype, (a.dtype, b.dtype)
        np.testing.assert_array_equal(a, b)
    else:
        assert a == b


def pack_records(p):
    """Convert pack title columns to exactly the shape read_titles gets from Crate."""
    t = p.titles
    keys = t["fingerprint_keys"]
    for i, key in enumerate(t["key"]):
        record = {"key": int(key), "has_poster": bool(t["has_poster"][i]),
                  "fingerprint_scores": {k: None if v == 255 else int(v)
                                         for k, v in zip(keys, t["fingerprint"][i])}}
        for c in job.FLOAT_COLUMNS + job.INT_COLUMNS:
            value = t["num"][c][i]
            record[c] = None if (np.isnan(value) if value.dtype.kind == 'f' else value < 0) else value.item()
        for c in ("genres", "original_language_code", "production_method"):
            record[c] = t["text"][c][i]
        yield record


def pack_tables(p):
    """Keep tier A others in parity, including all four side tables."""
    tables = {}
    for name, source in (("ratings", "ratings"), ("want_to_see", "wishlist"),
                         ("skip", "skipped"), ("not_interested", "not_interested")):
        t = getattr(p, source)
        mask = p.members["tier"][t["member"]] == 0
        cols = ("member", "title_key", "score") if name == "ratings" else ("member", "title_key")
        tables[name] = {c: t[c][mask] for c in cols}
    return tables


def request(c):
    return job.request_order(c["b3Rank"], c["b5TopHalf"], c["movieSeriesId"],
                             c["show"], c["animation"], c["ownShares"])


def fixture_case(ref, view, c, indices, name, no_mix=False):
    """Harness F3/mix with frozen global B5 bits, as the adopted request contract requires."""
    cols = {k: v[indices] for k, v in c.items() if k != "ownShares"}
    sample = {**view, "targets": {"title": view["targets"]["title"][indices]}}
    if no_mix:
        sample["me"] = {**view["me"], "ratings": {"title": np.zeros(0, np.int32)}}
    shares = None if no_mix else c["ownShares"]
    with patch.object(ref, "b3_predict", return_value={"rank": cols["b3Rank"]}), \
         patch.object(ref, "b5_predict", return_value={"rank": cols["b5TopHalf"].astype(float), "score": None, "p_low": None}), \
         patch.object(ref, "view_percentile", return_value=np.where(cols["b5TopHalf"], .75, .25)):
        f3 = ref.f3_predict(sample)
        final = ref.predict(sample)
    order = np.argsort(-final["rank"], kind="stable")
    groups = np.floor(f3["rank"] / 2).astype(np.int64)
    actual = request({**cols, "ownShares": shares})
    np.testing.assert_array_equal(actual["order"], order)
    np.testing.assert_array_equal(actual["groups"], groups)
    return {"name": name, "components": {k: v.tolist() for k, v in cols.items()},
            "ownShares": shares, "groups": groups.tolist(),
            "order": cols["pointIds"][order].tolist(), "mixCount": actual["mixCount"]}


def make_fixtures(ref, view, c):
    f3 = request({**c, "ownShares": None})["order"]
    selected = list(f3[:110])
    # Include all four kinds, all three groups, and both members of several franchises.
    codes = c["show"].astype(int) * 2 + c["animation"]
    for code in range(4):
        selected += np.flatnonzero(codes == code)[:4].tolist()
    groups = request({**c, "ownShares": None})["groups"]
    for group in range(3):
        selected += np.flatnonzero(groups == group)[:4].tolist()
    series = c["movieSeriesId"]
    counts = {int(s): int((series == s).sum()) for s in np.unique(series[series > 0])}
    for s in [s for s, n in counts.items() if n > 1][:4]:
        selected += np.flatnonzero(series == s)[:3].tolist()
    indices = np.array(list(dict.fromkeys(selected)), np.int64)
    # Preserve harness tie order, which stage 2 must take from its input list.
    indices.sort()
    cases = [fixture_case(ref, view, c, indices, "sample-with-suffix"),
             fixture_case(ref, view, c, indices[::-1], "reversed-input-ties"),
             fixture_case(ref, view, c, indices, "no-own-ratings", no_mix=True),
             fixture_case(ref, view, c, np.zeros(0, np.int64), "empty-filter")]
    # Drop every global franchise leader in the sample. Remaining siblings must be promoted.
    keep = np.array([i for i in indices if not (groups[i] == 2 and series[i] > 0)], np.int64)
    cases.append(fixture_case(ref, view, c, keep, "filtered-franchise-leaders"))
    cases.append(fixture_case(ref, view, c, indices[:11], "position-eleven"))
    return {"format": 1, "modelHash": job.MODEL_HASH, "cases": cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--research", required=True, type=Path)
    parser.add_argument("--pack", required=True, type=Path)
    parser.add_argument("--scratch", required=True, type=Path)
    parser.add_argument("--write-fixtures", action="store_true")
    parser.add_argument("--benchmark-only", action="store_true")
    args = parser.parse_args()
    assert args.scratch.resolve() == Path("~/goodwatch-research/taste/work/g1-job").expanduser().resolve()
    args.scratch.mkdir(parents=True, exist_ok=True)
    source = args.research / "candidates/009/g1_mix.py"
    assert sha256(source.read_bytes()).hexdigest() == job.MODEL_HASH, "Research source SHA-256 changed"
    copied = source.read_text().split("# BEGIN COPIED B5", 1)[1].split("# END COPIED B3", 1)[0]
    product = Path(job.__file__).read_text().split("# BEGIN COPIED B5", 1)[1].split("# END COPIED B3", 1)[0]
    assert product == copied, "Copied B3/B5 changed"
    sys.path.insert(0, str(args.research))
    from pack import Pack
    import views

    spec = importlib.util.spec_from_file_location("g1_reference", source)
    ref = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ref)
    began = time.monotonic()
    p = Pack(args.pack)
    # Loading core and title files is counted separately from the product array builder.
    _ = p.titles
    load_seconds = time.monotonic() - began
    started = time.monotonic()
    titles = job.build_titles(pack_records(p), p.titles["fingerprint_keys"])
    tables = pack_tables(p)
    job_view = job.build_view(titles, tables, p.owner)
    array_seconds = time.monotonic() - started
    started = time.monotonic()
    job._POOL.clear()
    b3 = job.b3_predict(job_view)
    b3_seconds = time.monotonic() - started
    started = time.monotonic()
    b5 = job.b5_predict(job_view)
    b5_seconds = time.monotonic() - started
    # Measure the actual entrypoint's per-member compute + encoding, without I/O.
    started = time.monotonic()
    data = job.payload(job_view, "offline-pack", datetime(2026, 10, 14, tzinfo=timezone.utc))
    encoded = json.dumps(data, separators=(",", ":"), allow_nan=False)
    payload_seconds = time.monotonic() - started
    timing = {"numpy": np.__version__, "threads": 2, "titles": len(titles["key"]),
              "candidates": len(job_view["targets"]["title"]), "own_ratings": len(job_view["me"]["ratings"]["title"]),
              "others_ratings": len(job_view["others"]["ratings"]["title"]),
              "pack_load_seconds": load_seconds, "array_seconds": array_seconds,
              "b3_seconds": b3_seconds, "b5_seconds": b5_seconds,
              "payload_seconds": payload_seconds, "job_compute_seconds": array_seconds + payload_seconds,
              "payload_bytes": len(encoded.encode()),
              "peak_rss_mib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024}
    if args.benchmark_only:
        (args.scratch / "benchmark.json").write_text(json.dumps(timing, indent=2) + "\n")
        print(json.dumps(timing, indent=2))
        return
    harness_titles = views.titles_of(views.title_arrays(p))
    for name in titles:
        if name == "num":
            for column, values in titles[name].items():
                equal_arrays(values, harness_titles[name][column])
        else:
            equal_arrays(titles[name], harness_titles[name])
    ctx = views._tables(p)
    mine, mine_title, _, unrated = views._t2a_member(ctx, p.owner)
    arrays, _, _, _ = views._t2a_arrays(ctx, p, p.owner, mine, mine_title,
                                      np.zeros(0, np.int64), unrated, "01300900")
    others = views._others_arrays(ctx, p.owner, "all")
    harness = views.view_of(arrays, others, harness_titles)
    # Only compare arrays the copied predictor reads; time/provenance are deliberately absent in the job.
    product = job.build_view(titles, tables, p.owner, harness["targets"]["title"])
    for who in ("me", "others"):
        for table in job.TABLES:
            for col, values in product[who][table].items():
                equal_arrays(values, harness[who][table][col])
    equal_arrays(product["targets"], harness["targets"])
    ref._POOL.clear()
    job._POOL.clear()
    expected_b3 = ref.b3_predict(harness)["rank"]
    expected_b5 = ref.b5_predict(harness)["rank"]
    np.testing.assert_array_equal(job.b3_predict(product)["rank"], expected_b3)
    np.testing.assert_array_equal(job.b5_predict(product)["rank"], expected_b5)
    c = job.components(product)
    np.testing.assert_array_equal(c["b3Rank"], expected_b3.astype(np.float32))
    np.testing.assert_array_equal(c["b5TopHalf"], ref.view_percentile(expected_b5) >= .5)
    expected_f3 = ref.f3_predict(harness)
    actual = request(c)
    np.testing.assert_array_equal(actual["groups"], np.floor(expected_f3["rank"] / 2).astype(np.int64))
    np.testing.assert_array_equal(request({**c, "ownShares": None})["order"],
                                  np.argsort(-expected_f3["rank"], kind="stable"))
    expected = np.argsort(-ref.predict(harness)["rank"], kind="stable")
    np.testing.assert_array_equal(actual["order"][:100], expected[:100])
    np.testing.assert_array_equal(actual["order"][100:], expected[100:])
    # Verify the JSON payload, sorted by point id, round-trips into the harness's tie order.
    stored = job.payload(product, "offline-pack", datetime(2026, 10, 14, tzinfo=timezone.utc))
    at = np.searchsorted(stored["pointIds"], c["pointIds"])
    roundtrip = {k: np.asarray(stored[k])[at] for k in c if k != "ownShares"}
    np.testing.assert_array_equal(request({**roundtrip, "ownShares": stored["ownShares"]})["order"], expected)
    # The actual product target order is sorted; test that order against the harness too.
    sorted_harness = {**harness, "targets": job_view["targets"]}
    canonical = job.components(job_view)
    np.testing.assert_array_equal(request(canonical)["order"],
                                  np.argsort(-ref.predict(sorted_harness)["rank"], kind="stable"))
    fixtures = make_fixtures(ref, harness, c)
    fixture_path = Path(__file__).parent / "fixtures/g1_order.json"
    if args.write_fixtures:
        fixture_path.write_text(json.dumps(fixtures, indent=2) + "\n")
    else:
        assert json.loads(fixture_path.read_text()) == fixtures, "Stage 2 fixtures differ"
    result = {"model_hash": job.MODEL_HASH, "arrays": "exact, including dtypes",
              "b3": "exact float64 source and float32 payload", "b5_rank": "exact",
              "b5_top_half": "exact", "f3_groups_and_order": "exact", "mix_first_100": "exact",
              "mix_suffix": "exact", "json_roundtrip": "exact", "sorted_product_order": "exact",
              "fixture_cases": len(fixtures["cases"]), "timing": timing,
              "parity_process_peak_rss_mib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024}
    (args.scratch / "parity.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
