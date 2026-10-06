"""The title snapshot publisher: its encoding round-trips through the webapp decoder's checks
(ported here, and the webapp's own code under Node when it is installed), it pages Crate, and it
publishes only when an analysis changed, keeping at most two versions in Redis. Beside it, the
ratings sidecar: codes to ages, ladders, its byte layout, and a failure that leaves the snapshot alone."""
import json
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from unittest.mock import patch

import fakeredis
import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import title_snapshot as ts

ROOT = Path(__file__).parents[1]
WEBAPP_KEYS = ROOT.parent / "goodwatch-webapp/app/server/utils/fingerprint.ts"


def decode(manifest: dict, chunks: list[bytes], key_order: list[str]) -> list[dict]:
    """A port of the webapp's checkManifest, joinChunks and checkRows (format.server.ts)."""
    assert manifest["format"] == 1
    assert isinstance(manifest["version"], str) and 1 <= len(manifest["version"]) <= 64
    assert all(c.isalnum() or c in "_.-" for c in manifest["version"])
    assert manifest["chunks"] == len(chunks) >= 1
    assert manifest["keyOrder"] == key_order
    assert len(manifest["genres"]) <= 32 and len(set(manifest["genres"])) == len(manifest["genres"])
    assert len(manifest["origins"]) <= 255 and len(set(manifest["origins"])) == len(manifest["origins"])
    datetime.fromisoformat(manifest["builtAt"].replace("Z", "+00:00"))
    data = b"".join(chunks)
    assert sha256(data).hexdigest() == manifest["sha256"]
    count = manifest["count"]
    assert len(data) == count * 101
    at = 0

    def take(fmt: str, width: int) -> tuple:
        nonlocal at
        values = struct.unpack_from(f"<{count}{fmt}", data, at)
        at += width * count
        return values

    point_ids, genres, days, votes = take("d", 8), take("I", 4), take("i", 4), take("I", 4)
    popularity = take("f", 4)
    fingerprints = data[at:at + 74 * count]
    at += 74 * count
    scores, origins, flags = take("B", 1), take("B", 1), take("B", 1)
    previous = float("-inf")
    for pid in point_ids:
        assert pid > previous, "point ids not ascending"
        tmdb_id = pid - 2e12 if pid >= 2e12 else pid - 1e12
        assert tmdb_id == int(tmdb_id) and 0 <= tmdb_id < 1e12
        previous = pid
    genre_bits = 0 if len(manifest["genres"]) >= 32 else ~((1 << len(manifest["genres"])) - 1) & 0xFFFFFFFF
    for r in range(count):
        assert not genres[r] & genre_bits
        assert origins[r] == 255 or origins[r] < len(manifest["origins"])
        assert scores[r] == 255 or scores[r] <= 100
    assert all(v <= 10 or v == 255 for v in fingerprints)
    return [{
        "point_id": point_ids[r],
        "genres": [g for i, g in enumerate(manifest["genres"]) if genres[r] >> i & 1],
        "release_day": days[r], "votes": votes[r], "popularity": popularity[r],
        "fingerprint": list(fingerprints[r * 74:(r + 1) * 74]), "score": scores[r],
        "origin": manifest["origins"][origins[r]] if origins[r] != 255 else None, "flags": flags[r],
    } for r in range(count)]


def decode_ratings(manifest: dict, chunks: list[bytes]) -> list[dict]:
    """The sidecar as the contract lays it out: content, estimate, then one age column per country."""
    ratings = manifest["ratings"]
    assert ratings["format"] == 1 and ratings["chunks"] == len(chunks) >= 1
    assert all(len(chunk) <= 1024 * 1024 for chunk in chunks)
    countries = ratings["countries"]
    assert countries == sorted(set(countries)) and len(countries) <= 64
    assert all(len(c) == 2 and c.isalpha() and c.isupper() for c in countries)
    assert sorted(ratings["ladders"]) == countries
    for steps in ratings["ladders"].values():
        ages = [step["age"] for step in steps]
        assert len(steps) >= 2 and ages == sorted(set(ages)) and all(0 <= age <= 18 for age in ages)
        assert all(set(step) <= {"age", "label", "show"} and step["label"] for step in steps)
    data = b"".join(chunks)
    assert sha256(data).hexdigest() == ratings["sha256"]
    count = manifest["count"]
    assert len(data) == count * (2 + len(countries))
    assert all(v < 32 for v in data[:count])
    assert all(v <= 18 or v == 255 for v in data[count:])
    return [{
        "content": data[r], "estimate": data[count + r],
        "ages": {c: data[(2 + i) * count + r] for i, c in enumerate(countries) if data[(2 + i) * count + r] != 255},
    } for r in range(count)]


def record(tmdb_id: int, *, scores=None, genres=("Drama",), day=0, score=71.9, votes=1234, popularity=12.5,
           countries=("US",), language="en", poster="/p.jpg", backdrop=None, adult=False, anime=None) -> list:
    """One Crate record in the publisher's column order."""
    scores = list(scores) if scores is not None else [k % 11 for k in range(74)]
    return [tmdb_id, *scores, list(genres) if genres is not None else None, day, score, votes, popularity,
            list(countries) if countries is not None else None, language, poster, backdrop, adult, anime]


CERTIFICATIONS = [
    # certification_code, country_code, media_type, order_default
    ["0", "DE", "movie", 1], ["6", "DE", "movie", 2], ["12", "DE", "movie", 3], ["16", "DE", "movie", 4],
    ["18", "DE", "movie", 5], ["12", "DE", "show", 3],
    ["NR", "US", "movie", 0], ["G", "US", "movie", 1], ["R", "US", "movie", 4], ["TV-MA", "US", "show", 6],
    ["E", "AU", "movie", 0], ["G", "AU", "movie", 1], ["PG", "AU", "movie", 2], ["M", "AU", "movie", 3],
    ["MA 15+", "AU", "movie", 4], ["R 18+", "AU", "movie", 5],
    ["P", "AU", "show", 1], ["G", "AU", "show", 3], ["MA15+", "AU", "show", 6], ["R18+", "AU", "show", 8],
    ["U", "GB", "movie", 1], ["PG", "GB", "movie", 2], ["12A", "GB", "movie", 3], ["12", "GB", "movie", 4],
    ["AL", "NL", "movie", 1], ["9", "NL", "show", 2],
    ["NR", "XX", "movie", 0], ["18", "XX", "movie", 1],
    ["13+", "CA-QC", "movie", 1], ["16+", "CA-QC", "movie", 2],
]


class FakeCrate:
    """Answers the publisher's statements from in-memory records per table: the mark, the title
    pages, the ratings pages (`[tmdb_id, age_certifications, content_advisories]`) and the
    `age_certification` lookup."""

    def __init__(self, tables: dict[str, list[list]], marks: dict[str, list[int]] | None = None,
                 ratings: dict[str, list[list]] | None = None, certifications: list[list] | None = None):
        self.tables = tables
        self.marks = marks or {"movie": [1, 10], "show": [1, 20]}
        self.ratings = ratings or {}
        self.certifications = CERTIFICATIONS if certifications is None else certifications
        self.statements: list[str] = []

    def select(self, sql: str, params: list) -> list:
        self.statements.append(sql)
        table = sql.split(" FROM ")[1].split()[0]
        if table == "age_certification":
            return self.certifications
        if sql.startswith("SELECT count(dna_updated_at)"):
            return [self.marks[table]]
        records = self.ratings.get(table, []) if "age_certifications" in sql else self.tables[table]
        last = params[0]
        found = sorted((r for r in records if r[0] > last), key=lambda r: r[0])
        return found[:ts.PAGE_SIZE]


class EncodingTest(unittest.TestCase):
    def rows(self):
        return [
            ts.to_row(ts.SHOW_BASE, record(1396, genres=["Crime", "Drama"], day=1_380_000_000_000, countries=[],
                                           language="en", anime=True, backdrop="/b.jpg")),
            ts.to_row(ts.MOVIE_BASE, record(603, scores=[None] * 3 + [10.4] + [7] * 70, day=-86_400_000 * 3,
                                            score=None, votes=None, popularity=None, countries=["DE"], poster=None,
                                            adult=True)),
            ts.to_row(ts.MOVIE_BASE, record(27205, genres=["Action", "Science Fiction"], day=None, score=100.0,
                                            votes=2**40, countries=None, language=None)),
        ]

    def test_the_key_order_is_the_webapps(self):
        source = WEBAPP_KEYS.read_text()
        block = source.split("VALID_FINGERPRINT_KEYS: readonly (keyof CoreScores)[] = [")[1].split("] as const")[0]
        webapp_keys = [part.strip().strip('"') for line in block.splitlines() if not line.strip().startswith("//")
                       for part in line.split(",") if part.strip().strip('"')]
        self.assertEqual(ts.KEY_ORDER, webapp_keys)

    def test_rows_round_trip_through_the_decoder_checks(self):
        built_at = datetime(2026, 9, 27, 18, 0, tzinfo=timezone.utc)
        manifest, chunks = ts.encode_snapshot(self.rows(), ts.version_of(built_at), built_at, {"sourceMark": {}})

        decoded = decode(manifest, chunks, ts.KEY_ORDER)

        self.assertEqual(manifest["version"], "20260927T180000Z")
        self.assertEqual(manifest["builtAt"], "2026-09-27T18:00:00.000Z")
        self.assertEqual(manifest["genres"], ["Action", "Crime", "Drama", "Science Fiction"])
        self.assertEqual(manifest["origins"], ["DE", "en"])
        self.assertEqual([r["point_id"] for r in decoded], [1e12 + 603, 1e12 + 27205, 2e12 + 1396])
        matrix, inception, breaking_bad = decoded
        self.assertEqual(matrix["fingerprint"][:5], [255, 255, 255, 10, 7])
        self.assertEqual((matrix["release_day"], matrix["score"], matrix["votes"], matrix["popularity"]),
                         (-3, 255, 0, 0.0))
        self.assertEqual((matrix["origin"], matrix["flags"]), ("DE", ts.FLAG_ADULT))
        self.assertEqual((inception["release_day"], inception["score"], inception["votes"], inception["origin"]),
                         (ts.UNKNOWN_DAY, 100, 2**32 - 1, None))
        self.assertEqual(inception["genres"], ["Action", "Science Fiction"])
        self.assertEqual((breaking_bad["release_day"], breaking_bad["score"], breaking_bad["popularity"]),
                         (15972, 71, 12.5))
        self.assertEqual((breaking_bad["origin"], breaking_bad["flags"]),
                         ("en", ts.FLAG_POSTER | ts.FLAG_BACKDROP | ts.FLAG_ANIME))

    def test_titles_without_scores_are_left_out(self):
        self.assertIsNone(ts.to_row(ts.MOVIE_BASE, record(1, scores=[None] * 74)))

    def test_chunks_hold_at_most_one_megabyte(self):
        rows = [ts.to_row(ts.MOVIE_BASE, record(i)) for i in range(1, 12_001)]
        manifest, chunks = ts.encode_snapshot(rows, "v", datetime.now(timezone.utc))

        self.assertEqual([len(c) for c in chunks], [1024 * 1024] * 1 + [12_000 * 101 - 1024 * 1024])
        self.assertEqual(manifest["chunks"], 2)
        decode(manifest, chunks, ts.KEY_ORDER)

    def test_an_empty_catalog_is_one_empty_chunk(self):
        manifest, chunks = ts.encode_snapshot([], "v", datetime.now(timezone.utc))

        self.assertEqual((manifest["count"], chunks), (0, [b""]))

    @unittest.skipUnless(shutil.which("node"), "needs Node to run the webapp's decoder")
    def test_the_webapp_decodes_it_and_encodes_the_same_bytes(self):
        rows = self.rows()
        built_at = datetime(2026, 9, 27, 18, 0, tzinfo=timezone.utc)
        manifest, chunks = ts.encode_snapshot(rows, "20260927T180000Z", built_at, {"sourceMark": {}})
        out = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, out)
        (out / "manifest.json").write_text(json.dumps(manifest))
        for n, chunk in enumerate(chunks):
            (out / f"chunk-{n}.bin").write_bytes(chunk)
        (out / "rows.json").write_text(json.dumps([{
            "pointId": r["point_id"], "genres": r["genres"], "releaseDay": r["release_day"], "votes": r["votes"],
            "popularity": r["popularity"], "fingerprint": list(r["fingerprint"]), "score": r["score"],
            "origin": r["origin"], "hasPoster": r["poster"], "hasBackdrop": r["backdrop"], "adult": r["adult"],
            "anime": r["anime"],
        } for r in rows]))

        result = subprocess.run(["node", str(ROOT / "tests/fixtures/title_snapshot_check.ts"), str(out)],
                                capture_output=True, text=True, check=True)
        checked = json.loads(result.stdout)

        self.assertEqual(checked["count"], 3)
        self.assertEqual([r["pointId"] for r in checked["rows"]], [1e12 + 603, 1e12 + 27205, 2e12 + 1396])
        self.assertEqual(checked["rows"][0]["fingerprint"][:4], [255, 255, 255, 10])
        self.assertEqual(checked["rows"][2]["releaseDay"], 15972)
        self.assertTrue(checked["sameSha256"] and checked["sameGenres"] and checked["sameOrigins"])


class ReadingTest(unittest.TestCase):
    def test_pages_by_tmdb_id_and_keeps_titles_with_scores(self):
        movies = [record(i) for i in range(1, 2 * ts.PAGE_SIZE + 2)] + [record(99_999, scores=[None] * 74)]
        crate = FakeCrate({"movie": movies, "show": []})

        rows = ts.read_rows(crate.select, "movie")

        self.assertEqual(len(rows), 2 * ts.PAGE_SIZE + 1)
        self.assertEqual(len(crate.statements), 3)
        self.assertTrue(all("dna_updated_at IS NOT NULL AND tmdb_id > ?" in s for s in crate.statements))
        self.assertNotIn("fingerprint_scores IS NOT NULL", crate.statements[0])
        self.assertIn("fingerprint_scores['adrenaline']", crate.statements[0])

    def test_a_failed_page_is_retried(self):
        crate = FakeCrate({"movie": [record(1)], "show": []})
        calls = []

        def flaky(sql, params):
            calls.append(sql)
            if len(calls) == 1:
                raise ConnectionError("reset")
            return crate.select(sql, params)

        with patch.object(ts.time, "sleep"):
            self.assertEqual(len(ts.read_rows(flaky, "movie")), 1)


class RatingsTest(unittest.TestCase):
    def test_a_code_is_an_age_by_table_then_number_then_all_ages_word(self):
        ages = {
            # Word codes, from the country's table.
            ("US", "PG-13"): 13, ("US", "R"): 17, ("US", "TV-Y7"): 7, ("US", "TV-MA"): 17, ("US", "NC-17"): 18,
            ("GB", "U"): 0, ("GB", "PG"): 8, ("GB", "12A"): 12, ("GB", "R18"): 18,
            ("AU", "M"): 15, ("AU", "MA 15+"): 15, ("AU", "MA15+"): 15, ("AU", "ma 15+"): 15, ("AU", "R 18+"): 18,
            ("IN", "A"): 18, ("HK", "IIB"): 16, ("MX", "B-15"): 15,
            # The first number, capped at 18.
            ("DE", "12"): 12, ("DE", "0"): 0, ("RU", "16+"): 16, ("IT", "VM14"): 14, ("PT", "M/12"): 12,
            ("FI", "K-7"): 7, ("SG", "R21"): 18, ("KR", "19"): 18, ("ZA", "10-12PG"): 10,
            # All ages words.
            ("NL", "AL"): 0, ("FR", "TP"): 0, ("BR", "L"): 0, ("IT", "T"): 0, ("DK", "A"): 0, ("ID", "SU"): 0,
            # Not a rating.
            ("US", "NR"): None, ("US", "Unrated"): None, ("DE", "ungeprüft"): None, ("AU", "E"): None,
            ("FR", ""): None, ("XX", "PG"): None,
        }

        self.assertEqual({key: ts.code_age(*key) for key in ages}, ages)

    def test_an_entry_splits_at_the_first_underscore(self):
        self.assertEqual(ts.parse_certification("DE_12"), ("DE", 12))
        self.assertEqual(ts.parse_certification("AU_MA 15+"), ("AU", 15))
        self.assertEqual(ts.parse_certification("US_TV_MA"), None)
        self.assertEqual(ts.parse_certification("IN_UA_13+"), ("IN", 13))
        self.assertEqual(ts.parse_certification("us_PG-13"), ("US", 13))
        for entry in ["US_NR", "US_", "_12", "12", "", "CA-QC_13+", "USA_12"]:
            self.assertIsNone(ts.parse_certification(entry), entry)

    def test_the_strictest_rating_of_a_country_counts(self):
        ratings = [ts.parse_certification(c) for c in ["DE_12", "DE_16", "DE_6", "GB_15", "GB_12A"]]

        self.assertEqual(ts.strictest_ages(ratings), {"DE": 16, "GB": 15})

    def test_the_estimate_is_the_lower_median(self):
        self.assertEqual(ts.estimate_age([12]), 12)
        self.assertEqual(ts.estimate_age([18, 6, 12]), 12)
        self.assertEqual(ts.estimate_age([16, 6, 12, 13]), 12)
        self.assertEqual(ts.estimate_age([0, 18]), 0)
        self.assertEqual(ts.estimate_age([]), ts.NO_AGE)

    def test_advisory_tags_are_content_bits(self):
        self.assertEqual(ts.content_bits(["Violence", "Nudity", "Sexual Content"]), 0b00011)
        self.assertEqual(ts.content_bits(["Disturbing Imagery", "Strong Language", "Drug Use"]), 0b11100)
        self.assertEqual(ts.content_bits(["Suicide Themes"]), ts.CONTENT_DISTURBING)
        self.assertEqual(ts.content_bits(["Smoking", None, 7]), 0)
        self.assertEqual(ts.content_bits(None), 0)
        # Every tag of the vocabulary is decided on, and nothing else is.
        from typing import get_args
        from f.dna.models import ContentAdvisory
        self.assertEqual(set(ts.ADVISORY_CONTENT), set(get_args(ContentAdvisory)))

    def test_ladders_are_built_from_the_certification_table(self):
        ladders = ts.build_ladders(CERTIFICATIONS)

        self.assertEqual(sorted(ladders), ["AU", "DE", "GB", "NL", "US"])
        self.assertEqual(ladders["DE"], [{"age": age, "label": f"FSK {age}"} for age in (0, 6, 12, 16, 18)])
        # Fixed, whatever the table lists for the US.
        self.assertEqual(ladders["US"], [
            {"age": 0, "label": "G", "show": "TV-G"}, {"age": 8, "label": "PG", "show": "TV-PG"},
            {"age": 14, "label": "PG-13", "show": "TV-14"}, {"age": 17, "label": "R", "show": "TV-MA"},
        ])
        # M and MA 15+ share an age: the lower order labels it. Shows are rated MA15+ there, not M.
        self.assertEqual(ladders["AU"], [
            {"age": 0, "label": "G"}, {"age": 8, "label": "PG"}, {"age": 15, "label": "M", "show": "MA15+"},
            {"age": 18, "label": "R 18+"},
        ])
        self.assertEqual(ladders["GB"], [{"age": 0, "label": "U"}, {"age": 8, "label": "PG"},
                                         {"age": 12, "label": "12A"}])
        # A show code adds the step the movie codes lack.
        self.assertEqual(ladders["NL"], [{"age": 0, "label": "AL"}, {"age": 9, "label": "9"}])

    def test_a_country_with_fewer_than_two_steps_has_no_ladder(self):
        ladders = ts.build_ladders([["NR", "XX", "movie", 0], ["18", "XX", "movie", 1], ["18", "XX", "show", 1],
                                    ["Unrated", "YY", "movie", 0]])

        self.assertEqual(sorted(ladders), ["US"])

    def test_the_bytes_are_content_then_estimate_then_a_column_per_country(self):
        ladders = ts.build_ladders(CERTIFICATIONS)
        titles = {
            ts.MOVIE_BASE + 603: (ts.CONTENT_VIOLENCE | ts.CONTENT_LANGUAGE,
                                  (("DE", 16), ("US", 17), ("GB", 15), ("DE", 12), ("FR", 12))),
            ts.SHOW_BASE + 1396: (ts.CONTENT_DRUGS, (("US", 17),)),
            ts.MOVIE_BASE + 1: (0, (("DE", 0),)),  # not in the snapshot
        }
        point_ids = [ts.MOVIE_BASE + 603, ts.MOVIE_BASE + 604, ts.SHOW_BASE + 1396]

        field, chunks = ts.encode_ratings(point_ids, titles, ladders)

        self.assertEqual(field["countries"], ["AU", "DE", "GB", "NL", "US"])
        self.assertEqual(b"".join(chunks), bytes([
            9, 0, 16,        # content
            15, 255, 17,     # estimate: the lower median of DE 16, US 17, GB 15, FR 12; rated nowhere; US 17
            255, 255, 255,   # AU
            16, 255, 255,    # DE, the strictest of 16 and 12
            15, 255, 255,    # GB
            255, 255, 255,   # NL
            17, 255, 17,     # US
        ]))
        self.assertEqual(len(b"".join(chunks)), 3 * (2 + 5))
        self.assertEqual((field["format"], field["chunks"]), (1, 1))
        self.assertEqual(field["sha256"], sha256(b"".join(chunks)).hexdigest())
        self.assertEqual(field["ladders"], ladders)

    def test_chunks_hold_at_most_one_megabyte(self):
        ladders = ts.build_ladders(CERTIFICATIONS)
        point_ids = [ts.MOVIE_BASE + i for i in range(1, 200_001)]

        field, chunks = ts.encode_ratings(point_ids, {}, ladders)

        self.assertEqual([len(c) for c in chunks], [1024 * 1024, 200_000 * 7 - 1024 * 1024])
        self.assertEqual(field["chunks"], 2)

    def test_at_most_64_countries_get_a_column_and_the_most_rated_stay(self):
        codes = [a + b for a in "ABC" for b in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"][:70]
        ladders = ts.build_ladders([[age, country, "movie", n] for country in codes for n, age in enumerate(["6", "12"])])
        ladders.pop("US", None)
        # Every title is rated in the last 60 countries; the first ten are rated once or never.
        titles = {i: (0, tuple((c, 12) for c in codes[10:])) for i in range(1, 6)}
        titles[1] = (0, titles[1][1] + (("AD", 6), ("AB", 6), ("AH", 6), ("AF", 6)))

        field, chunks = ts.encode_ratings([1, 2, 3, 4, 5], titles, ladders)

        self.assertEqual(len(field["countries"]), 64)
        self.assertEqual(field["countries"], sorted(["AB", "AD", "AF", "AH"] + codes[10:]))
        self.assertEqual(sorted(field["ladders"]), field["countries"])
        self.assertEqual(len(b"".join(chunks)), 5 * (2 + 64))

    def test_an_empty_catalog_is_one_empty_chunk(self):
        field, chunks = ts.encode_ratings([], {}, ts.build_ladders(CERTIFICATIONS))

        self.assertEqual((field["chunks"], chunks), (1, [b""]))

    def test_ratings_are_read_in_their_own_pages(self):
        movies = [[i, ["DE_12", "US_NR"], ["Violence"]] for i in range(1, ts.PAGE_SIZE + 2)]
        movies += [[90_000, None, None], [90_001, ["US_Unrated"], []], [90_002, [], ["Drug Use"]]]
        crate = FakeCrate({"movie": [], "show": []}, ratings={"movie": movies})

        titles = ts.read_ratings(crate.select, "movie")

        self.assertEqual(len(crate.statements), 2)
        self.assertTrue(all(s.startswith("SELECT tmdb_id, age_certifications, content_advisories FROM movie WHERE"
                                         " dna_updated_at IS NOT NULL AND tmdb_id > ?") for s in crate.statements))
        # Titles with neither a rating nor a flag take no room.
        self.assertEqual(len(titles), ts.PAGE_SIZE + 2)
        self.assertEqual(titles[ts.MOVIE_BASE + 1], (ts.CONTENT_VIOLENCE, (("DE", 12),)))
        self.assertEqual(titles[ts.MOVIE_BASE + 90_002], (ts.CONTENT_DRUGS, ()))


class PublishingTest(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.crate = FakeCrate(
            {"movie": [record(603), record(604)], "show": [record(1396)]},
            ratings={
                "movie": [[603, ["DE_16", "US_R", "GB_15", "DE_12"], ["Violence", "Strong Language"]],
                          [9999, ["DE_0"], []]],
                "show": [[1396, ["US_TV-MA", "AU_MA 15+", "DE_NR"], ["Drug Use", "Violence"]]],
            },
        )
        self.clock = iter(datetime(2026, 9, 27, 18, minute, tzinfo=timezone.utc) for minute in range(60))

    def run_once(self, **kwargs):
        return ts.run(self.redis, self.crate.select, now=lambda: next(self.clock), **kwargs)

    def stored(self):
        manifest = json.loads(self.redis.get(ts.CURRENT_KEY))
        chunks = [self.redis.get(ts.chunk_key(manifest["version"], n)) for n in range(manifest["chunks"])]
        return manifest, chunks

    def stored_ratings(self):
        manifest = json.loads(self.redis.get(ts.CURRENT_KEY))
        return manifest, [self.redis.get(ts.ratings_chunk_key(manifest["version"], n))
                          for n in range(manifest["ratings"]["chunks"])]

    def versions(self):
        return sorted({key.decode().split(":")[1] for key in self.redis.scan_iter("title-snapshot:*:*")})

    def keys(self):
        return sorted(key.decode() for key in self.redis.scan_iter("title-snapshot:*:*"))

    def test_the_first_run_publishes_a_decodable_snapshot(self):
        result = self.run_once()

        manifest, chunks = self.stored()
        self.assertTrue(result["published"])
        self.assertEqual((manifest["count"], result["count"], result["source"]), (3, 3, "crate"))
        self.assertEqual(manifest["sourceMark"], {"movie": [1, 10], "show": [1, 20], "ratings": 1})
        self.assertEqual(len(decode(manifest, chunks, ts.KEY_ORDER)), 3)
        self.assertIsNone(self.redis.get(ts.LOCK_KEY))

    def test_the_ratings_sidecar_is_published_beside_it(self):
        result = self.run_once()

        manifest, chunks = self.stored_ratings()
        matrix, unrated, breaking_bad = decode_ratings(manifest, chunks)
        self.assertEqual(manifest["ratings"]["countries"], ["AU", "DE", "GB", "NL", "US"])
        self.assertEqual(manifest["ratings"]["ladders"]["DE"][2], {"age": 12, "label": "FSK 12"})
        self.assertEqual(matrix, {"content": ts.CONTENT_VIOLENCE | ts.CONTENT_LANGUAGE, "estimate": 16,
                                  "ages": {"DE": 16, "GB": 15, "US": 17}})
        self.assertEqual(unrated, {"content": 0, "estimate": 255, "ages": {}})
        self.assertEqual(breaking_bad, {"content": ts.CONTENT_VIOLENCE | ts.CONTENT_DRUGS, "estimate": 15,
                                        "ages": {"AU": 15, "US": 17}})
        self.assertEqual(result["ratings"], {"countries": 5, "chunks": 1, "bytes": 3 * 7})
        self.assertEqual(self.keys(), ["title-snapshot:20260927T180000Z:0", "title-snapshot:20260927T180000Z:ratings:0"])

    def test_the_snapshot_is_the_same_bytes_with_the_sidecar(self):
        self.run_once()

        manifest, chunks = self.stored()
        built_at = datetime(2026, 9, 27, 18, 0, tzinfo=timezone.utc)
        rows = [ts.to_row(ts.MOVIE_BASE, record(603)), ts.to_row(ts.MOVIE_BASE, record(604)),
                ts.to_row(ts.SHOW_BASE, record(1396))]
        plain, plain_chunks = ts.encode_snapshot(rows, "20260927T180000Z", built_at, {"sourceMark": manifest["sourceMark"]})
        self.assertEqual(chunks, plain_chunks)
        self.assertEqual({k: v for k, v in manifest.items() if k != "ratings"}, plain)
        self.assertEqual((manifest["format"], list(manifest)[-1]), (1, "ratings"))

    def test_the_first_run_over_an_older_publishers_snapshot_publishes(self):
        self.run_once()
        older = json.loads(self.redis.get(ts.CURRENT_KEY))
        del older["ratings"], older["sourceMark"]["ratings"]
        self.redis.set(ts.CURRENT_KEY, json.dumps(older))

        self.assertTrue(self.run_once()["published"])
        self.assertIn("ratings", self.stored()[0])
        self.assertFalse(self.run_once()["published"])

    def assert_published_without_ratings(self, result, step):
        manifest, chunks = self.stored()
        self.assertTrue(result["published"])
        self.assertNotIn("ratings", manifest)
        self.assertNotIn("ratings", result)
        self.assertTrue(result["ratings_error"].startswith(step), result["ratings_error"])
        self.assertEqual(len(decode(manifest, chunks, ts.KEY_ORDER)), 3)
        self.assertEqual(self.keys(), ["title-snapshot:20260927T180000Z:0"])
        self.assertIsNone(self.redis.get(ts.LOCK_KEY))

    def test_a_sidecar_that_fails_to_build_leaves_the_snapshot_published(self):
        with patch.object(ts, "encode_ratings", side_effect=ValueError("boom")), \
                patch("builtins.print") as printed:
            result = self.run_once()

        self.assert_published_without_ratings(result, "building it: ValueError('boom')")
        self.assertIn("RATINGS SIDECAR FAILED", printed.call_args_list[-1].args[0])

    def test_a_ratings_read_that_fails_leaves_the_snapshot_published(self):
        def select(sql, params):
            if "age_certification" in sql:
                raise ConnectionError("timeout")
            return self.crate.select(sql, params)

        with patch.object(ts.time, "sleep"), patch("builtins.print"):
            result = ts.run(self.redis, select, now=lambda: next(self.clock))

        self.assert_published_without_ratings(result, "building it: ConnectionError('timeout')")

    def test_a_ratings_write_that_fails_leaves_the_snapshot_published(self):
        write = self.redis.set

        def flaky(key, *args, **kwargs):
            if ":ratings:" in str(key):
                raise ConnectionError("reset")
            return write(key, *args, **kwargs)

        with patch.object(self.redis, "set", side_effect=flaky), patch("builtins.print"):
            result = self.run_once()

        self.assert_published_without_ratings(result, "writing it: ConnectionError('reset')")

    def test_a_run_without_changed_analyses_publishes_nothing(self):
        self.run_once()
        statements = len(self.crate.statements)

        result = self.run_once()

        self.assertFalse(result["published"])
        self.assertEqual(result["version"], "20260927T180000Z")
        # Only the two mark aggregates ran; no title was read.
        self.assertEqual(len(self.crate.statements), statements + 2)

    def test_a_forced_run_or_a_changed_analysis_publishes(self):
        self.run_once()
        self.assertTrue(self.run_once(force=True)["published"])
        self.crate.marks["show"] = [2, 40]
        self.crate.tables["show"].append(record(1399))

        result = self.run_once()

        self.assertTrue(result["published"])
        self.assertEqual(self.stored()[0]["count"], 4)

    def test_at_most_two_versions_remain(self):
        self.redis.set("title-snapshot:dev-old:0", b"x")
        self.redis.set("title-snapshot:unrelated", b"kept")
        for _ in range(3):
            self.run_once(force=True)

        self.assertEqual(self.versions(), ["20260927T180100Z", "20260927T180200Z"])
        self.assertEqual(self.redis.get("title-snapshot:unrelated"), b"kept")

    def test_the_ratings_chunks_of_old_versions_are_deleted_with_them(self):
        self.redis.set("title-snapshot:dev-old:ratings:0", b"x")
        for _ in range(3):
            self.run_once(force=True)

        self.assertEqual(self.keys(), [
            "title-snapshot:20260927T180100Z:0", "title-snapshot:20260927T180100Z:ratings:0",
            "title-snapshot:20260927T180200Z:0", "title-snapshot:20260927T180200Z:ratings:0",
        ])

    def test_a_dry_run_writes_nothing(self):
        result = self.run_once(dry_run=True)

        self.assertFalse(result["published"])
        self.assertEqual(result["count"], 3)
        self.assertEqual(self.redis.keys("title-snapshot:*"), [])

    def test_a_dry_run_ignores_the_lock(self):
        self.redis.set(ts.LOCK_KEY, "other")

        self.assertEqual(self.run_once(dry_run=True)["count"], 3)
        self.assertEqual(self.redis.get(ts.LOCK_KEY), b"other")

    def test_a_run_while_another_publishes_leaves_it_alone(self):
        self.redis.set(ts.LOCK_KEY, "other")

        result = self.run_once()

        self.assertEqual(result["reason"], "another publish is running")
        self.assertEqual(self.redis.get(ts.LOCK_KEY), b"other")
        self.assertIsNone(self.redis.get(ts.CURRENT_KEY))


class VectorCopyTriggerTest(unittest.TestCase):
    def test_a_scheduled_copy_starts_the_publisher_and_a_targeted_one_does_not(self):
        from f.sync.copy import vector_data

        with patch.object(vector_data, "init_mongodb"), patch.object(vector_data, "close_mongodb"), \
                patch.object(vector_data, "QdrantConnector"), \
                patch.object(vector_data, "get_db", return_value=mongomock.MongoClient().db), \
                patch.object(vector_data, "copy_to_qdrant", side_effect=lambda *args, **kwargs: {
                    "selected": 0, "upserts": 0, "skipped_unknown_streaming": 0}), \
                patch("wmill.run_script_by_path_async", return_value="job-1") as start:
            scheduled = vector_data.main()
            targeted = vector_data.main(movie_ids=["603"])

        self.assertEqual(scheduled["title_snapshot"], "job-1")
        self.assertNotIn("title_snapshot", targeted)
        start.assert_called_once_with(path="f/sync/copy/title_snapshot", args={})


if __name__ == "__main__":
    unittest.main()
