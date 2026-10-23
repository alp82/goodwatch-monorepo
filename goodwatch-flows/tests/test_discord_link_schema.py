"""Discord identity links follow the same explicit-timestamp convention as handles."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.sync.models.crate_schemas import SCHEMAS


class DiscordLinkSchemaTests(unittest.TestCase):
    def test_discord_identity_and_rollout_schema(self):
        spec = SCHEMAS["user_discord_link"]
        self.assertEqual(spec["columns"], {
            "discord_user_id": "TEXT",
            "user_id": "TEXT NOT NULL",
            "discord_username": "TEXT",
            "linked_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
            "deleted_at": "TIMESTAMP WITH TIME ZONE",
        })
        self.assertEqual(spec["primary_key"], ["discord_user_id"])
        self.assertEqual(spec["shards"], 1)
        self.assertEqual(spec["replicas"], "0-1")
        self.assertIs(spec["timestamps"], False)
