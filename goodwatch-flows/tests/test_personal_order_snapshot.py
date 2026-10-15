"""A catalog can gain analyzed titles while the currently served snapshot stays unchanged."""
import gzip
import json
import sys
import unittest
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.sync.copy import personal_order as job
from test_personal_order import records, tables


def snapshot(keys, chunk_size=13):
    # Format 1 starts with sorted float64 point IDs. The rest of its columns are immaterial here.
    keys = np.asarray(keys, dtype="<f8")
    raw = keys.tobytes() + bytes(len(keys) * (27 + 2 - 8))
    chunks = [raw[i:i + chunk_size] for i in range(0, len(raw), chunk_size)] or [b""]
    manifest = {"version": "snapshot-before-new-analysis", "format": 1, "count": len(keys),
                "chunks": len(chunks), "sha256": sha256(raw).hexdigest(), "keyOrder": ["a", "b"]}
    values = {f"title-snapshot:{manifest['version']}:{i}": chunk for i, chunk in enumerate(chunks)}
    values["title-snapshot:current"] = json.dumps(manifest)
    redis = Mock()
    redis.get.side_effect = values.get
    return redis, manifest, values


class PublicationMembership(unittest.TestCase):
    def test_new_catalog_candidate_cannot_poison_the_existing_snapshot_payload(self):
        # Both movies are candidates now, but only the first was in the published snapshot.
        # The rated show is outside it too: it must still contribute to the member's own mix.
        redis, manifest, _ = snapshot([10**12 + 1])
        titles = job.build_titles(records(), ["a", "b"])
        now = datetime(2026, 10, 16, tzinfo=timezone.utc)
        with patch.object(job, "read_members", return_value=(tables(), {"test-member": 0})), \
             patch.object(job, "read_titles", return_value=titles), \
             patch.object(job, "pooled_rating_predict", return_value={"rank": np.array([0.0, 1.0])}), \
             patch.object(job, "taste_vector", return_value=np.array([1.0, 0.0])):
            unfiltered = job.payload(job.build_view(titles, tables(), 0), manifest["version"], now)
            result = job.run(redis, Mock(), ["test-member"], ["a", "b"], dry_run=False, now=lambda: now)
        published = json.loads(gzip.decompress(redis.set.call_args.args[1]))
        self.assertEqual(published["pointIds"], [10**12 + 1])
        for column in ("ownTasteRank", "pooledRatingTopHalf", "movieSeriesId", "show", "animation"):
            self.assertEqual(published[column], unfiltered[column][:1], column)
        for field in ("ownShares", "othersCount", "othersRatingsCount", "modelHash", "builtAt"):
            self.assertEqual(published[field], unfiltered[field], field)
        self.assertEqual(published["ownShares"], [1.0, 1.0])
        self.assertEqual(result["members"][0]["candidates"], 1)
        self.assertEqual(published["snapshotVersion"], manifest["version"])

    def test_unreadable_snapshot_restores_claimed_dirty_members_before_any_publication(self):
        redis, manifest, values = snapshot([10**12 + 1])
        del values[f"title-snapshot:{manifest['version']}:0"]
        redis.scard.return_value = 1
        redis.spop.return_value = [b"test-member"]
        with self.assertRaisesRegex(ValueError, "Missing title snapshot chunk"):
            job.run(redis, Mock(), ["test-member"], ["a", "b"], dry_run=False, dirty_only=True)
        redis.sadd.assert_called_once_with("personal-order:dirty", b"test-member")
        redis.set.assert_not_called()
        redis.delete.assert_not_called()


class SnapshotPointIds(unittest.TestCase):
    def test_float64_ids_across_chunk_boundaries_and_empty_snapshot(self):
        for keys in ([10**12 + 1, 10**12 + 2, 2 * 10**12 + 3], []):
            with self.subTest(keys=keys):
                redis, manifest, _ = snapshot(keys)
                self.assertEqual(job.read_snapshot_point_ids(redis, manifest).tolist(), keys)

    def test_corrupt_non_id_columns_are_also_rejected(self):
        redis, manifest, values = snapshot([10**12 + 1])
        last = f"title-snapshot:{manifest['version']}:{manifest['chunks'] - 1}"
        values[last] = b"\xff" + values[last][1:]
        with self.assertRaisesRegex(ValueError, "integrity mismatch"):
            job.read_snapshot_point_ids(redis, manifest)

    def test_truncated_snapshot_and_unsupported_format_are_rejected(self):
        for change in ("length", "format"):
            with self.subTest(change=change):
                redis, manifest, _ = snapshot([10**12 + 1])
                manifest["count" if change == "length" else "format"] = 2
                with self.assertRaises(ValueError):
                    job.read_snapshot_point_ids(redis, manifest)

    def test_invalid_unsorted_or_duplicate_ids_are_rejected_even_with_valid_checksum(self):
        for keys in ([10**12 + 2, 10**12 + 1], [10**12 + 1] * 2, [1], [10**12 + 0.5], [float("nan")]):
            with self.subTest(keys=keys):
                redis, manifest, _ = snapshot(keys)
                with self.assertRaisesRegex(ValueError, "Invalid title snapshot point IDs"):
                    job.read_snapshot_point_ids(redis, manifest)


if __name__ == "__main__":
    unittest.main()
