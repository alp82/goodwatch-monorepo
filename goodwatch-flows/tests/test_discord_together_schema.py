"""Discord group outcomes schema, without a database connection."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.sync.models.crate_schemas import SCHEMAS


class DiscordTogetherSchemaTests(unittest.TestCase):
    def test_outcome_schema(self):
        self.assertEqual(SCHEMAS["discord_together"], {
            "columns": {
                "session_id": "TEXT", "guild_id": "TEXT", "channel_id": "TEXT",
                "message_id": "TEXT", "starter_id": "TEXT", "type": "TEXT",
                "mood": "TEXT", "status": "TEXT", "decided_tmdb_id": "INTEGER",
                "decided_media_type": "TEXT", "participant_count": "INTEGER",
                "created_at": "TIMESTAMP WITH TIME ZONE",
                "ended_at": "TIMESTAMP WITH TIME ZONE",
            },
            "primary_key": ["session_id"], "shards": 1, "replicas": "0-1", "timestamps": False,
        })


if __name__ == "__main__":
    unittest.main()
