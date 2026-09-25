"""The details copy deletes the child rows of live titles that TMDB no longer lists (#166)."""
import re
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import stale_child_rows, tmdb_details
from f.sync.copy.deleted_titles import title_table, title_tables
from f.sync.copy.stale_child_rows import STALE_ROW_TABLES, is_full_details_payload
from f.sync.models.crate_schemas import SCHEMAS


def ms(date: str) -> int:
    """How Crate returns a release date the copy wrote: epoch milliseconds.

    The copy converts Mongo's naive datetimes with the worker's local time zone (UTC on
    the workers), so the expectation does the same to stay independent of the test machine.
    """
    return round(datetime.fromisoformat(date).timestamp() * 1000)


class FakeCursor:
    def __init__(self, crate):
        self.crate = crate
        self.rowcount = 0

    def executemany(self, sql, seq_of_params):
        return self.crate.bulk_delete(sql, seq_of_params)


class ChildRowCrate:
    """Crate child tables as rows by primary key. Applies upserts and the stale row deletes."""

    def __init__(self, drop_upserts_into=()):
        self.rows = {table: {} for table in STALE_ROW_TABLES}
        self.drop_upserts_into = set(drop_upserts_into)
        self.selects = []
        self.deletes = []
        self.statements = []
        self.cur = FakeCursor(self)

    @staticmethod
    def pk(table):
        return SCHEMAS[table]["primary_key"]

    def add(self, table, media_type, tmdb_id, *key):
        values = (tmdb_id, media_type, *key)
        self.rows[table][values] = dict(zip(self.pk(table), values))

    def keys(self, table, media_type, tmdb_id):
        return sorted(pk[2:] for pk in self.rows[table] if pk[:2] == (tmdb_id, media_type))

    def upsert_many(self, *, table, records, conflict_columns, **kwargs):
        if table in self.rows and table not in self.drop_upserts_into:
            for record in records:
                row = record.model_dump()
                if table == "release_event":
                    # Crate reads a DOUBLE timestamp as epoch seconds and returns milliseconds.
                    row["release_date"] = round(row["release_date"] * 1000)
                self.rows[table][tuple(row[column] for column in conflict_columns)] = row
        return {"records_received": len(records), "rows_upserted": len(records)}

    def select(self, sql, params=None):
        match = re.fullmatch(r"SELECT (.+) FROM (\w+) WHERE media_type = \? AND media_tmdb_id = ANY\(\?\)", sql)
        if not match:
            return []
        columns = [column.strip() for column in match.group(1).split(",")]
        table = match.group(2)
        self.selects.append((table, sorted(params[1])))
        media_type, ids = params
        return [
            {column: row[column] for column in columns}
            for row in self.rows[table].values()
            if row["media_type"] == media_type and row["media_tmdb_id"] in ids
        ]

    def run(self, sql, params=None):
        self.statements.append(sql)

    def bulk_delete(self, sql, seq_of_params):
        table, where = re.fullmatch(r"DELETE FROM (\w+) WHERE (.+)", sql).groups()
        columns = re.findall(r"(\w+) = \?", where)
        assert where == " AND ".join(f"{column} = ?" for column in columns), sql
        assert columns == self.pk(table), sql
        seq_of_params = [tuple(params) for params in seq_of_params]
        self.deletes.append((table, len(seq_of_params)))
        results = []
        for params in seq_of_params:
            removed = self.rows[table].pop(params, None)
            results.append({"rowcount": 1 if removed else 0})
        return results


def copy(crate, media_type, documents):
    db = MagicMock()
    collection = db.tmdb_movie_details if media_type == "movie" else db.tmdb_tv_details
    collection.count_documents.return_value = len(documents)
    collection.find.return_value.sort.return_value.skip.return_value.limit.side_effect = [documents, []]
    with patch.object(tmdb_details, "get_db", return_value=db):
        return tmdb_details.copy_media(crate, {}, media_type, recent_only=False)


def movie(tmdb_id, **fields):
    """A movie document from a full details fetch, with every list empty unless given."""
    return {
        "tmdb_id": tmdb_id,
        "title": f"Movie {tmdb_id}",
        "images": {"backdrops": [], "posters": [], "logos": []},
        "credits": {"cast": [], "crew": []},
        "release_dates": {"results": []},
    } | fields


def show(tmdb_id, **fields):
    """A show document from a full details fetch, with every list empty unless given."""
    return {
        "tmdb_id": tmdb_id,
        "title": f"Show {tmdb_id}",
        "images": {"backdrops": [], "posters": [], "logos": []},
        "aggregate_credits": {"cast": [], "crew": []},
    } | fields


def document(media_type, tmdb_id, **fields):
    return (movie if media_type == "movie" else show)(tmdb_id, **fields)


def without(doc, *keys):
    return {key: value for key, value in doc.items() if key not in keys}


def image(path, language=None):
    return {"file_path": path, "iso_639_1": language, "aspect_ratio": 1.5, "width": 100, "height": 150}


def video(video_id):
    return {"id": video_id, "site": "YouTube", "key": f"key-{video_id}", "type": "Trailer"}


def stale(result, table):
    return result["stale_child_rows"][table]["rows_deleted"]


class FullPayloadGuardTests(unittest.TestCase):
    def test_images_and_the_media_types_credits_make_a_full_payload(self):
        self.assertTrue(is_full_details_payload(movie(1), is_movie=True))
        self.assertTrue(is_full_details_payload(show(1), is_movie=False))

    def test_missing_images_or_credits_is_partial(self):
        self.assertFalse(is_full_details_payload(without(movie(1), "images"), is_movie=True))
        self.assertFalse(is_full_details_payload(without(movie(1), "credits"), is_movie=True))
        self.assertFalse(is_full_details_payload(without(show(1), "aggregate_credits"), is_movie=False))
        self.assertFalse(is_full_details_payload(movie(1, images=None), is_movie=True))

    def test_credits_of_the_other_media_type_do_not_count(self):
        self.assertFalse(is_full_details_payload(without(movie(1), "credits") | {"aggregate_credits": {}}, is_movie=True))
        self.assertFalse(is_full_details_payload(without(show(1), "aggregate_credits") | {"credits": {}}, is_movie=False))


class MediaImageTests(unittest.TestCase):
    def test_images_tmdb_no_longer_lists_are_deleted(self):
        for media_type, other in (("movie", "show"), ("show", "movie")):
            with self.subTest(media_type=media_type):
                crate = ChildRowCrate()
                crate.add("media_image", media_type, 1, "backdrops", "/a.jpg", "")
                crate.add("media_image", media_type, 1, "backdrops", "/old.jpg", "")
                crate.add("media_image", media_type, 1, "posters", "/p.jpg", "en")
                crate.add("media_image", media_type, 1, "posters", "/p.jpg", "de")
                crate.add("media_image", media_type, 2, "backdrops", "/old.jpg", "")
                crate.add("media_image", other, 1, "backdrops", "/old.jpg", "")
                result = copy(crate, media_type, [document(media_type, 1, images={
                    "backdrops": [image("/a.jpg")], "posters": [image("/p.jpg", "en")], "logos": []})])
                self.assertEqual(crate.keys("media_image", media_type, 1),
                                 [("backdrops", "/a.jpg", ""), ("posters", "/p.jpg", "en")])
                self.assertEqual(crate.keys("media_image", media_type, 2), [("backdrops", "/old.jpg", "")])
                self.assertEqual(crate.keys("media_image", other, 1), [("backdrops", "/old.jpg", "")])
                self.assertEqual(stale(result, "media_image"), 2)

    def test_image_types_the_payload_does_not_list_keep_their_rows(self):
        crate = ChildRowCrate()
        crate.add("media_image", "movie", 1, "logos", "/logo.png", "en")
        crate.add("media_image", "movie", 1, "backdrops", "/old.jpg", "")
        copy(crate, "movie", [movie(1, images={"backdrops": [image("/a.jpg")]})])
        self.assertEqual(crate.keys("media_image", "movie", 1),
                         [("backdrops", "/a.jpg", ""), ("logos", "/logo.png", "en")])

    def test_an_empty_image_list_deletes_that_types_rows(self):
        crate = ChildRowCrate()
        crate.add("media_image", "movie", 1, "logos", "/logo.png", "en")
        crate.add("media_image", "movie", 1, "posters", "/p.jpg", "")
        copy(crate, "movie", [movie(1, images={"posters": [image("/p.jpg")], "logos": []})])
        self.assertEqual(crate.keys("media_image", "movie", 1), [("posters", "/p.jpg", "")])

    def test_missing_images_object_keeps_every_image(self):
        crate = ChildRowCrate()
        crate.add("media_image", "movie", 1, "backdrops", "/old.jpg", "")
        copy(crate, "movie", [without(movie(1), "images")])
        self.assertEqual(crate.deletes, [])
        self.assertEqual(crate.keys("media_image", "movie", 1), [("backdrops", "/old.jpg", "")])


class MediaVideoTests(unittest.TestCase):
    def test_videos_tmdb_no_longer_lists_are_deleted(self):
        for media_type in ("movie", "show"):
            with self.subTest(media_type=media_type):
                crate = ChildRowCrate()
                crate.add("media_video", media_type, 1, "v-old")
                crate.add("media_video", media_type, 1, "v-kept")
                result = copy(crate, media_type, [document(media_type, 1, videos=[video("v-kept"), video("v-new")])])
                self.assertEqual(crate.keys("media_video", media_type, 1), [("v-kept",), ("v-new",)])
                self.assertEqual(stale(result, "media_video"), 1)

    def test_full_payload_without_videos_deletes_every_video(self):
        # MongoEngine drops an empty top-level list, so "no videos" is an absent field.
        crate = ChildRowCrate()
        crate.add("media_video", "movie", 1, "v-1")
        crate.add("media_video", "movie", 1, "v-2")
        result = copy(crate, "movie", [movie(1)])
        self.assertEqual(crate.keys("media_video", "movie", 1), [])
        self.assertEqual(stale(result, "media_video"), 2)

    def test_partial_payload_keeps_videos(self):
        crate = ChildRowCrate()
        for tmdb_id in (1, 2):
            crate.add("media_video", "movie", tmdb_id, "v-old")
        copy(crate, "movie", [without(movie(1), "images"), without(movie(2), "credits")])
        self.assertEqual(crate.keys("media_video", "movie", 1), [("v-old",)])
        self.assertEqual(crate.keys("media_video", "movie", 2), [("v-old",)])


class AlternativeTitleTests(unittest.TestCase):
    def test_countries_tmdb_no_longer_lists_are_deleted(self):
        for media_type in ("movie", "show"):
            with self.subTest(media_type=media_type):
                crate = ChildRowCrate()
                crate.add("alternative_title", media_type, 1, "US")
                crate.add("alternative_title", media_type, 1, "FR")
                copy(crate, media_type, [document(media_type, 1, alternative_titles=[
                    {"iso_3166_1": "US", "title": "First"},
                    {"iso_3166_1": "US", "title": "Second"},
                    {"iso_3166_1": "DE", "title": "Titel"},
                ])])
                self.assertEqual(crate.keys("alternative_title", media_type, 1), [("DE",), ("US",)])

    def test_full_payload_without_alternative_titles_deletes_them(self):
        crate = ChildRowCrate()
        crate.add("alternative_title", "show", 1, "US")
        copy(crate, "show", [show(1)])
        self.assertEqual(crate.keys("alternative_title", "show", 1), [])

    def test_partial_payload_keeps_alternative_titles(self):
        crate = ChildRowCrate()
        crate.add("alternative_title", "show", 1, "US")
        copy(crate, "show", [without(show(1), "aggregate_credits")])
        self.assertEqual(crate.keys("alternative_title", "show", 1), [("US",)])


class TranslationTests(unittest.TestCase):
    def test_translations_tmdb_no_longer_lists_are_deleted(self):
        for media_type in ("movie", "show"):
            with self.subTest(media_type=media_type):
                crate = ChildRowCrate()
                crate.add("translation", media_type, 1, "en", "US")
                crate.add("translation", media_type, 1, "fr", "FR")
                crate.add("translation", media_type, 1, "fr", "CA")
                copy(crate, media_type, [document(media_type, 1, translations=[
                    {"iso_639_1": "en", "iso_3166_1": "US", "data": {"title": "T"}},
                    {"iso_639_1": "fr", "iso_3166_1": "CA", "data": {"title": "T"}},
                ])])
                self.assertEqual(crate.keys("translation", media_type, 1), [("en", "US"), ("fr", "CA")])

    def test_partial_payload_keeps_translations(self):
        crate = ChildRowCrate()
        crate.add("translation", "movie", 1, "fr", "FR")
        copy(crate, "movie", [without(movie(1), "images")])
        self.assertEqual(crate.keys("translation", "movie", 1), [("fr", "FR")])


class ReleaseEventTests(unittest.TestCase):
    def test_release_events_tmdb_no_longer_lists_are_deleted(self):
        crate = ChildRowCrate()
        crate.add("release_event", "movie", 1, "AR", ms("1999-11-04"), 3, "18")
        crate.add("release_event", "movie", 1, "US", ms("1999-10-15"), 3, "R")
        crate.add("release_event", "movie", 1, "CA", ms("1999-10-15"), 3, "")
        crate.add("release_event", "movie", 1, "CA", ms("2026-01-01"), 4, "")
        result = copy(crate, "movie", [movie(1, release_dates={"results": [
            {"iso_3166_1": "AR", "release_dates": [{"release_date": datetime(1999, 11, 4), "type": 3, "certification": "+18"}]},
            {"iso_3166_1": "US", "release_dates": [{"release_date": datetime(1999, 10, 15), "type": 3, "certification": "R"}]},
            {"iso_3166_1": "CA", "release_dates": [{"release_date": datetime(1999, 10, 15), "type": 3, "certification": None}]},
        ]})])
        self.assertEqual(crate.keys("release_event", "movie", 1), [
            ("AR", ms("1999-11-04"), 3, "+18"),
            ("CA", ms("1999-10-15"), 3, ""),
            ("US", ms("1999-10-15"), 3, "R"),
        ])
        self.assertEqual(stale(result, "release_event"), 2)

    def test_empty_release_dates_delete_every_release_event(self):
        crate = ChildRowCrate()
        crate.add("release_event", "movie", 1, "US", ms("1999-10-15"), 3, "R")
        copy(crate, "movie", [movie(1)])
        self.assertEqual(crate.keys("release_event", "movie", 1), [])

    def test_missing_release_dates_object_keeps_release_events(self):
        crate = ChildRowCrate()
        crate.add("release_event", "movie", 1, "US", ms("1999-10-15"), 3, "R")
        crate.add("release_event", "movie", 2, "US", ms("1999-10-15"), 3, "R")
        copy(crate, "movie", [without(movie(1), "release_dates"), movie(2, release_dates={})])
        self.assertEqual(crate.deletes, [])

    def test_shows_never_delete_release_events(self):
        crate = ChildRowCrate()
        crate.add("release_event", "show", 1, "US", ms("1999-10-15"), 3, "R")
        copy(crate, "show", [show(1, release_dates={"results": []})])
        self.assertEqual(crate.keys("release_event", "show", 1), [("US", ms("1999-10-15"), 3, "R")])


class PersonAppearedInTests(unittest.TestCase):
    def test_movie_cast_tmdb_no_longer_lists_is_deleted(self):
        crate = ChildRowCrate()
        crate.add("person_appeared_in", "movie", 1, 10, "c-kept")
        crate.add("person_appeared_in", "movie", 1, 11, "c-old")
        crate.add("person_appeared_in", "show", 1, 11, "c-old")
        result = copy(crate, "movie", [movie(1, credits={"crew": [], "cast": [
            {"id": 10, "name": "Kept", "credit_id": "c-kept", "character": "Hero"},
        ]})])
        self.assertEqual(crate.keys("person_appeared_in", "movie", 1), [(10, "c-kept")])
        self.assertEqual(crate.keys("person_appeared_in", "show", 1), [(11, "c-old")])
        self.assertEqual(stale(result, "person_appeared_in"), 1)

    def test_show_roles_tmdb_no_longer_lists_are_deleted(self):
        crate = ChildRowCrate()
        crate.add("person_appeared_in", "show", 1, 10, "r-kept")
        crate.add("person_appeared_in", "show", 1, 10, "r-old")
        copy(crate, "show", [show(1, aggregate_credits={"crew": [], "cast": [
            {"id": 10, "name": "Kept", "roles": [{"credit_id": "r-kept", "character": "Hero", "episode_count": 3}]},
        ]})])
        self.assertEqual(crate.keys("person_appeared_in", "show", 1), [(10, "r-kept")])

    def test_empty_cast_deletes_every_cast_row(self):
        crate = ChildRowCrate()
        crate.add("person_appeared_in", "movie", 1, 10, "c-old")
        copy(crate, "movie", [movie(1)])
        self.assertEqual(crate.keys("person_appeared_in", "movie", 1), [])

    def test_missing_credits_object_keeps_cast(self):
        crate = ChildRowCrate()
        crate.add("person_appeared_in", "movie", 1, 10, "c-old")
        crate.add("person_appeared_in", "show", 2, 10, "r-old")
        copy(crate, "movie", [without(movie(1), "credits")])
        copy(crate, "show", [without(show(2), "aggregate_credits")])
        self.assertEqual(crate.deletes, [])


class PersonWorkedOnTests(unittest.TestCase):
    def test_movie_crew_tmdb_no_longer_lists_is_deleted(self):
        crate = ChildRowCrate()
        crate.add("person_worked_on", "movie", 1, 20, "j-kept")
        crate.add("person_worked_on", "movie", 1, 21, "j-old")
        copy(crate, "movie", [movie(1, credits={"cast": [], "crew": [
            {"id": 20, "name": "Director", "credit_id": "j-kept", "job": "Director", "department": "Directing"},
        ]})])
        self.assertEqual(crate.keys("person_worked_on", "movie", 1), [(20, "j-kept")])

    def test_show_creators_join_the_kept_crew(self):
        crate = ChildRowCrate()
        crate.add("person_worked_on", "show", 1, 20, "j-kept")
        crate.add("person_worked_on", "show", 1, 20, "j-old")
        crate.add("person_worked_on", "show", 1, 30, "cb-kept")
        crate.add("person_worked_on", "show", 1, 31, "cb-old")
        result = copy(crate, "show", [show(
            1,
            aggregate_credits={"cast": [], "crew": [
                {"id": 20, "name": "Writer", "jobs": [{"credit_id": "j-kept", "job": "Writer"}]},
            ]},
            created_by=[{"id": 30, "name": "Creator", "credit_id": "cb-kept"}],
        )])
        self.assertEqual(crate.keys("person_worked_on", "show", 1), [(20, "j-kept"), (30, "cb-kept")])
        self.assertEqual(stale(result, "person_worked_on"), 2)

    def test_partial_show_payload_keeps_crew_and_creators(self):
        # Without the full payload an absent created_by may just be unfetched.
        crate = ChildRowCrate()
        crate.add("person_worked_on", "show", 1, 31, "cb-old")
        copy(crate, "show", [without(show(1), "images")])
        self.assertEqual(crate.keys("person_worked_on", "show", 1), [(31, "cb-old")])

    def test_missing_credits_object_keeps_movie_crew(self):
        crate = ChildRowCrate()
        crate.add("person_worked_on", "movie", 1, 21, "j-old")
        copy(crate, "movie", [without(movie(1), "credits")])
        self.assertEqual(crate.keys("person_worked_on", "movie", 1), [(21, "j-old")])


class StaleChildRowTests(unittest.TestCase):
    def test_title_tables_know_each_tables_primary_key(self):
        for media_type in ("movie", "show"):
            for table in title_tables(media_type):
                if table.key_columns:
                    self.assertEqual(list(table.primary_key), SCHEMAS[table.name]["primary_key"], table.name)
        for table in STALE_ROW_TABLES:
            self.assertTrue(title_table("movie", table).key_columns, table)

    def test_titles_outside_the_batch_are_untouched(self):
        crate = ChildRowCrate()
        for table, key in (("media_video", ("v",)), ("translation", ("fr", "FR")), ("person_worked_on", (1, "j"))):
            crate.add(table, "movie", 1, *key)
            crate.add(table, "movie", 2, *key)
        copy(crate, "movie", [movie(1)])
        for table in ("media_video", "translation", "person_worked_on"):
            self.assertEqual(crate.keys(table, "movie", 1), [])
            self.assertNotEqual(crate.keys(table, "movie", 2), [])
            self.assertTrue(all(2 not in ids for _, ids in crate.selects))

    def test_selects_and_deletes_are_chunked(self):
        crate = ChildRowCrate()
        for tmdb_id in range(1, 6):
            crate.add("media_video", "movie", tmdb_id, "v-a")
            crate.add("media_video", "movie", tmdb_id, "v-b")
        with patch.object(stale_child_rows, "STALE_ROW_TITLES_PER_SELECT", 2), \
                patch.object(stale_child_rows, "STALE_ROWS_PER_DELETE", 3):
            result = copy(crate, "movie", [movie(tmdb_id) for tmdb_id in range(1, 6)])
        self.assertEqual([ids for table, ids in crate.selects if table == "media_video"], [[1, 2], [3, 4], [5]])
        self.assertEqual([size for table, size in crate.deletes if table == "media_video"], [3, 3, 3, 1])
        self.assertEqual(stale(result, "media_video"), 10)

    def test_document_without_a_title_keeps_its_rows(self):
        crate = ChildRowCrate()
        crate.add("media_video", "movie", 1, "v-old")
        copy(crate, "movie", [movie(1, title=None)])
        self.assertEqual(crate.keys("media_video", "movie", 1), [("v-old",)])

    def test_flagged_deleted_title_keeps_its_rows_for_the_tmdb_deleted_path(self):
        crate = ChildRowCrate()
        crate.add("media_video", "movie", 1, "v-old")
        copy(crate, "movie", [movie(1, tmdb_deleted=True)])
        self.assertEqual(crate.keys("media_video", "movie", 1), [("v-old",)])

    def test_rows_the_upsert_did_not_leave_in_crate_block_the_delete(self):
        # If kept keys are not all found after the upsert, the key comparison is not trusted.
        crate = ChildRowCrate(drop_upserts_into={"media_video"})
        crate.add("media_video", "movie", 1, "v-old")
        result = copy(crate, "movie", [movie(1, videos=[video("v-new")])])
        self.assertEqual(crate.keys("media_video", "movie", 1), [("v-old",)])
        self.assertEqual(result["stale_child_rows"]["media_video"]["titles_unverified"], 1)

    def test_an_implausible_share_of_stale_rows_is_refused(self):
        crate = ChildRowCrate()
        for tmdb_id in range(1, 4):
            for n in range(4):
                crate.add("translation", "movie", tmdb_id, f"l{n}", "XX")
        with patch.object(stale_child_rows, "MIN_ROWS_FOR_SHARE_CHECK", 10):
            result = copy(crate, "movie", [movie(tmdb_id) for tmdb_id in range(1, 4)])
        self.assertEqual(len(crate.keys("translation", "movie", 1)), 4)
        self.assertEqual(result["stale_child_rows"]["translation"]["batches_refused"], 1)
        self.assertEqual(stale(result, "translation"), 0)

    def test_result_reports_every_table(self):
        result = copy(ChildRowCrate(), "movie", [movie(1)])
        self.assertEqual(set(result["stale_child_rows"]), set(STALE_ROW_TABLES))
        self.assertEqual(result["stale_child_rows"]["media_image"],
                         {"titles_checked": 1, "titles_unverified": 0, "rows_deleted": 0, "batches_refused": 0})


if __name__ == "__main__":
    unittest.main()
