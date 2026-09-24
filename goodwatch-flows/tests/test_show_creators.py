import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import tmdb_details


def copy_one(document: dict, media_type: str) -> dict[str, list]:
    """Run copy_media on one Mongo document and return the upserted records per table."""
    db = MagicMock()
    collection = db.tmdb_movie_details if media_type == "movie" else db.tmdb_tv_details
    collection.count_documents.return_value = 1
    collection.find.return_value.sort.return_value.skip.return_value.limit.side_effect = [[document], []]
    connector = MagicMock()
    connector.select.return_value = []
    tables: dict[str, list] = {}

    def record_batch(*, table, records, conflict_columns, **kwargs):
        tables.setdefault(table, []).extend(records)
        return {"records_received": len(records), "rows_upserted": len(records)}

    connector.upsert_many.side_effect = record_batch
    with patch.object(tmdb_details, "get_db", return_value=db):
        tmdb_details.copy_media(connector, {"tmdb_id": document["tmdb_id"]}, media_type, recent_only=False)
    return tables


class ShowCreatorTests(unittest.TestCase):
    show = {
        "tmdb_id": 1396,
        "title": "Breaking Bad",
        "created_by": [
            {"id": 66633, "credit_id": "cb-gilligan", "name": "Vince Gilligan", "original_name": "Vince Gilligan",
             "gender": 2, "profile_path": "/vg.jpg"},
            {"id": 7, "credit_id": "cb-no-name", "name": None},
            {"id": 8, "credit_id": "crew-writer", "name": "Collides With Crew"},
        ],
        "aggregate_credits": {"crew": [
            {"id": 66633, "name": "Vince Gilligan", "popularity": 5.5, "known_for_department": "Writing",
             "jobs": [{"credit_id": "crew-writer", "job": "Writer", "episode_count": 13}]},
        ]},
    }

    def test_created_by_becomes_creator_crew_credits(self):
        tables = copy_one(self.show, "show")
        creators = [row for row in tables["person_worked_on"] if row.job == "Creator"]
        self.assertEqual(
            [(row.media_tmdb_id, row.media_type, row.person_tmdb_id, row.credit_id, row.department) for row in creators],
            [(1396, "show", 66633, "cb-gilligan", None)],
        )
        # The crew row stays, and the person keeps the crew's fuller record.
        self.assertIn("crew-writer", [row.credit_id for row in tables["person_worked_on"]])
        people = [person for person in tables["person"] if person.tmdb_id == 66633]
        self.assertEqual(len(people), 1)
        self.assertEqual(people[0].popularity, 5.5)

    def test_creator_without_crew_credit_gets_a_person_row(self):
        show = self.show | {"aggregate_credits": {"crew": []}}
        tables = copy_one(show, "show")
        person = next(person for person in tables["person"] if person.tmdb_id == 66633)
        self.assertEqual((person.name, person.profile_path, person.gender), ("Vince Gilligan", "/vg.jpg", 2))

    def test_show_without_creators_writes_none(self):
        tables = copy_one({"tmdb_id": 5, "title": "No Creator"}, "show")
        self.assertNotIn("person_worked_on", tables)

    def test_movies_ignore_created_by(self):
        tables = copy_one(self.show | {"aggregate_credits": {}}, "movie")
        self.assertNotIn("person_worked_on", tables)


if __name__ == "__main__":
    unittest.main()
