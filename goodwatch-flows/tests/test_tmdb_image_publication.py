import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import tmdb_details
from f.sync.models.crate_schemas import SCHEMAS


class MetadataPublicationTests(unittest.TestCase):
    def test_optional_source_metadata_has_stable_nonnull_publication_keys(self):
        image = {
            "file_path": "/backdrop.jpg", "aspect_ratio": 1.5,
            "width": 1500, "height": 1000,
        }
        document = {
            "tmdb_id": 11, "title": "Example",
            "release_dates": {"results": [{
                "iso_3166_1": "US", "release_dates": [
                    {"release_date": "2020-01-01", "type": 1},
                    {"release_date": "2020-01-02", "type": 2, "certification": None},
                    {"release_date": "2020-01-03", "type": 3, "certification": ""},
                    {"release_date": "2020-01-04", "type": 4, "certification": "PG"},
                ],
            }]},
            "images": {"backdrops": [
                image, image | {"iso_639_1": None},
                image | {"iso_639_1": ""}, image | {"iso_639_1": "en"},
            ]},
        }
        for media_type in ("movie", "show"):
            with self.subTest(media_type=media_type):
                db = MagicMock()
                collection = db.tmdb_movie_details if media_type == "movie" else db.tmdb_tv_details
                collection.count_documents.return_value = 1
                collection.find.return_value.sort.return_value.skip.return_value.limit.side_effect = [[document], []]
                db.tmdb_movie_providers.find.return_value = []
                db.tmdb_tv_providers.find.return_value = []
                connector = MagicMock()
                connector.select.return_value = []
                images = []
                releases = []

                def record_batch(*, table, records, conflict_columns, **kwargs):
                    for record in records:
                        data = record.model_dump()
                        self.assertTrue(all(data[key] is not None for key in SCHEMAS[table]["primary_key"]))
                    if table == "media_image":
                        images.extend(records)
                    if table == "release_event":
                        releases.extend(records)
                    return {"records_received": len(records), "rows_upserted": len(records)}

                connector.upsert_many.side_effect = record_batch
                with patch.object(tmdb_details, "get_db", return_value=db):
                    tmdb_details.copy_media(connector, {"tmdb_id": 11}, media_type, recent_only=False)
                self.assertEqual([image.language_code for image in images], ["", "en"])
                self.assertEqual([release.certification for release in releases], ["", "", "", "PG"])


if __name__ == "__main__":
    unittest.main()
