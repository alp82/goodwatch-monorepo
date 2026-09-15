"""Real CrateDB atomic ledger/OCC checks; only use a disposable local instance."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from provider_alias_resolution import transfer_demand
from test_priority_queue_integration import QueueIntegrationTests


class AliasDemandIntegrationTests(QueueIntegrationTests):
    def test_missing_canonical_and_repeat(self):
        transfer_demand(self.db, 5338654, 4)
        transfer_demand(self.db, 5338654, 4)
        row = self.db.select("SELECT demand, acknowledged_demand, alias_demand_transfers FROM crawl_priority WHERE media_type='movie' AND tmdb_id=658039")[0]
        self.assertEqual(row, {'demand': 4, 'acknowledged_demand': 0, 'alias_demand_transfers': {'5338654': 4}})

    def test_lost_committed_response_then_resume(self):
        run = self.db.run
        lost = False
        def lose(sql, args=()):
            nonlocal lost
            run(sql, args)
            if 'SET demand = demand + ?' in sql and not lost:
                lost = True
                raise TimeoutError('commit succeeded; response lost')
        with patch.object(self.db, 'run', side_effect=lose):
            with self.assertRaises(TimeoutError):
                transfer_demand(self.db, 162483, 52)
        transfer_demand(self.db, 162483, 52)
        row = self.db.select("SELECT demand, alias_demand_transfers FROM crawl_priority WHERE media_type='movie' AND tmdb_id=10679")[0]
        self.assertEqual(row['demand'], 52)
        self.assertEqual(row['alias_demand_transfers'], {'162483': 52})

    def test_concurrent_enqueue_and_existing_ack_preserved(self):
        self.db.run("INSERT INTO crawl_priority (media_type, tmdb_id, demand, acknowledged_demand) VALUES ('movie',10679,10,7)")
        run = self.db.run
        raced = False
        def race(sql, args=()):
            nonlocal raced
            if 'SET demand = demand + ?' in sql and not raced:
                raced = True
                run("UPDATE crawl_priority SET demand=demand+3 WHERE media_type='movie' AND tmdb_id=10679")
            run(sql, args)
        with patch.object(self.db, 'run', side_effect=race):
            transfer_demand(self.db, 162483, 52)
        row = self.db.select("SELECT demand, acknowledged_demand FROM crawl_priority WHERE media_type='movie' AND tmdb_id=10679")[0]
        self.assertEqual(row, {'demand': 65, 'acknowledged_demand': 7})

    def test_zero_and_later_increment(self):
        transfer_demand(self.db, 3635601, 0)
        transfer_demand(self.db, 3635601, 2)
        transfer_demand(self.db, 3635601, 2)
        row = self.db.select("SELECT demand, alias_demand_transfers FROM crawl_priority WHERE media_type='movie' AND tmdb_id=872517")[0]
        self.assertEqual(row, {'demand': 2, 'alias_demand_transfers': {'3635601': 2}})
