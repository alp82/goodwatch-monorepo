"""Discord server settings schema, without a database connection."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.sync.models.crate_schemas import SCHEMAS


class DiscordGuildSchemaTests(unittest.TestCase):
    def test_guild_settings_schema(self):
        self.assertEqual(SCHEMAS["discord_guild"], {
            "columns": {
                "guild_id": "TEXT", "country": "TEXT", "service_ids": "ARRAY(INTEGER)",
                "digest_channel_id": "TEXT", "updated_by": "TEXT",
                "updated_at": "TIMESTAMP WITH TIME ZONE",
            },
            "primary_key": ["guild_id"], "shards": 1, "replicas": "0-1", "timestamps": False,
        })


if __name__ == "__main__":
    unittest.main()
