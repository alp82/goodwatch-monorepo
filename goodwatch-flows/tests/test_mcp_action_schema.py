"""The MCP receipt table is created by hand at the auth cut-over, never by the daily schema initializer."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "goodwatch-flows/windmill"))
from f.sync.models.crate_schemas import SCHEMAS


class McpActionSchemaTests(unittest.TestCase):
    def test_the_initializer_does_not_create_the_receipt_table(self):
        # f/sync/populate_crate runs f/sync/init/cratedb daily, which creates every table in SCHEMAS.
        self.assertNotIn("user_mcp_action", SCHEMAS)

    def test_the_hand_written_table_has_the_columns_the_webapp_uses(self):
        sql = (ROOT / "docs/implementation/mcp-write-tools-schema.sql").read_text()
        statement = "\n".join(line for line in sql.splitlines() if not line.startswith("--"))
        columns = re.findall(r"^\s+(\w+) (TEXT|TIMESTAMP)", statement, re.MULTILINE)
        self.assertEqual(
            [name for name, _ in columns],
            ["user_id", "action_id", "request_hash", "owner_id", "result", "created_at", "updated_at"],
        )
        self.assertIn("PRIMARY KEY (user_id, action_id)", statement)
        self.assertIn("CLUSTERED BY (user_id) INTO 3 SHARDS", statement)


if __name__ == "__main__":
    unittest.main()
