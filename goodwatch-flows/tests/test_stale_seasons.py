import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import tmdb_details


class SeasonTable:
    """A fake Crate connector that holds season rows and applies the stale season delete."""

    def __init__(self, rows: list[tuple[int, int]]):
        self.rows = {season_id: show_id for season_id, show_id in rows}
        self.deletes = []
        self.cur = MagicMock()

    def select(self, sql, params=None):
        return []

    def upsert_many(self, *, table, records, conflict_columns, **kwargs):
        if table == "season":
            self.rows.update({record.tmdb_id: int(record.show_id) for record in records})
        return {"records_received": len(records), "rows_upserted": len(records)}

    def run(self, sql, params=None):
        if not sql.startswith("DELETE FROM season"):
            return
        self.assert_stale_delete(sql)
        show_ids, kept_ids = params
        self.deletes.append((sorted(show_ids), sorted(kept_ids)))
        stale = [season_id for season_id, show_id in self.rows.items()
                 if show_id in show_ids and season_id not in kept_ids]
        for season_id in stale:
            del self.rows[season_id]
        self.cur.rowcount = len(stale)

    @staticmethod
    def assert_stale_delete(sql):
        assert sql == "DELETE FROM season WHERE show_id = ANY(?) AND NOT (tmdb_id = ANY(?))", sql

    def seasons_of(self, show_id):
        return sorted(season_id for season_id, owner in self.rows.items() if owner == show_id)


def copy_shows(connector, documents):
    db = MagicMock()
    collection = db.tmdb_tv_details
    collection.count_documents.return_value = len(documents)
    collection.find.return_value.sort.return_value.skip.return_value.limit.side_effect = [documents, []]
    with patch.object(tmdb_details, "get_db", return_value=db):
        return tmdb_details.copy_media(connector, {}, "show", recent_only=False)


def show(tmdb_id, season_ids, **fields):
    return {
        "tmdb_id": tmdb_id,
        "title": f"Show {tmdb_id}",
        "seasons": [{"id": season_id, "season_number": number} for number, season_id in enumerate(season_ids)],
    } | fields


class StaleSeasonTests(unittest.TestCase):
    def test_seasons_tmdb_no_longer_lists_are_deleted(self):
        # Show 1 lost season 12 and re-created season 13 as 14. Show 2 was not synced.
        crate = SeasonTable([(11, 1), (12, 1), (13, 1), (21, 2), (22, 2)])
        result = copy_shows(crate, [show(1, [11, 14])])
        self.assertEqual(crate.seasons_of(1), [11, 14])
        self.assertEqual(crate.seasons_of(2), [21, 22])
        self.assertEqual(result["stale_seasons"]["rows_deleted"], 2)

    def test_one_delete_covers_many_shows(self):
        crate = SeasonTable([(11, 1), (12, 1), (21, 2), (22, 2), (31, 3)])
        copy_shows(crate, [show(1, [11]), show(2, [21, 22])])
        self.assertEqual(crate.deletes, [([1, 2], [11, 21, 22])])
        self.assertEqual((crate.seasons_of(1), crate.seasons_of(2), crate.seasons_of(3)), ([11], [21, 22], [31]))

    def test_deletes_are_chunked_by_show(self):
        with patch.object(tmdb_details, "STALE_SEASON_SHOWS_PER_DELETE", 2):
            crate = SeasonTable([(100 + show_id, show_id) for show_id in range(1, 6)])
            copy_shows(crate, [show(show_id, [200 + show_id]) for show_id in range(1, 6)])
        self.assertEqual([shows for shows, _ in crate.deletes], [[1, 2], [3, 4], [5]])
        self.assertEqual(crate.deletes[0][1], [201, 202])
        self.assertEqual(sorted(crate.rows), [201, 202, 203, 204, 205])

    def test_payload_without_seasons_keeps_existing_rows(self):
        crate = SeasonTable([(11, 1), (21, 2), (31, 3), (41, 4)])
        copy_shows(crate, [
            {"tmdb_id": 1, "title": "No seasons field"},
            show(2, []),
            {"tmdb_id": 3, "title": "Seasons are null", "seasons": None},
            show(4, [None]),
        ])
        self.assertEqual(crate.deletes, [])
        self.assertEqual(sorted(crate.rows), [11, 21, 31, 41])

    def test_skipped_documents_keep_their_seasons(self):
        # A document without a title is not published, so its seasons are left alone.
        crate = SeasonTable([(11, 1)])
        copy_shows(crate, [show(1, [12], title=None)])
        self.assertEqual(crate.deletes, [])
        self.assertEqual(crate.seasons_of(1), [11])

    def test_movies_never_touch_seasons(self):
        db = MagicMock()
        db.tmdb_movie_details.count_documents.return_value = 1
        db.tmdb_movie_details.find.return_value.sort.return_value.skip.return_value.limit.side_effect = [
            [{"tmdb_id": 1, "title": "Movie", "seasons": [{"id": 5}]}], []]
        crate = SeasonTable([(11, 1)])
        with patch.object(tmdb_details, "get_db", return_value=db):
            tmdb_details.copy_media(crate, {}, "movie", recent_only=False)
        self.assertEqual(crate.deletes, [])


if __name__ == "__main__":
    unittest.main()
