"""Exercise the actual importer queries against Wikibase's special-value RDF shape."""

import json
import sys
import unittest
from pathlib import Path

from rdflib import Graph

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.awards.wikidata import fetch_category, value

PREFIXES = """
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wds: <http://www.wikidata.org/entity/statement/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX pr: <http://www.wikidata.org/prop/reference/>
PREFIX wdno: <http://www.wikidata.org/prop/novalue/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX prov: <http://www.w3.org/ns/prov#>
"""


class RDFClient:
    def __init__(self, rdf):
        self.graph = Graph().parse(data=PREFIXES + rdf, format="turtle")

    def query(self, query):
        return json.loads(self.graph.query(PREFIXES + query).serialize(format="json"))[
            "results"
        ]["bindings"]


class SpecialValuePagesTests(unittest.TestCase):
    def test_real_no_winner_statements_do_not_make_complete_pages_look_partial(self):
        # Actual GUIDs of the three blocked scopes. Minimized RDF retains the
        # identity, rank and explicit no-value type from their source statements.
        examples = [
            ("Q2925697", "e3b51245-4e6d-c6ee-d07d-b1854213ddf0"),
            ("Q518675", "477a52c0-41e6-f4bf-9d44-21f49defdd70"),
            ("Q2530270", "a7a5865c-4c91-59f3-63c8-995e794c6af1"),
        ]
        for category, guid in examples:
            with self.subTest(category=category):
                client = RDFClient(f"""
                    wd:{category} p:P1346 wds:{category}-{guid}, wds:{category}-winner .
                    wds:{category}-{guid} a wikibase:Statement, wdno:P1346 ;
                        wikibase:rank wikibase:NormalRank ; pq:P585 "2011-01-01" .
                    wds:{category}-winner a wikibase:Statement ;
                        ps:P1346 wd:Q202589 ; wikibase:rank wikibase:NormalRank .
                """)
                rows = fetch_category(client, category)
                self.assertEqual(len({value(r, "statement") for r in rows}), 2)
                no_winner = [r for r in rows if value(r, "statement").endswith(guid)]
                self.assertTrue(no_winner)
                self.assertTrue(all("object" not in r for r in no_winner))
                self.assertTrue(
                    all(
                        value(r, "no_value")
                        == "http://www.wikidata.org/prop/novalue/P1346"
                        for r in no_winner
                    )
                )

    def test_missing_main_value_without_explicit_no_value_is_still_rejected(self):
        client = RDFClient("""
            wd:Q2925697 p:P1346 wds:Q2925697-incomplete .
            wds:Q2925697-incomplete wikibase:rank wikibase:NormalRank .
        """)
        with self.assertRaisesRegex(ValueError, "Incomplete Wikidata statement page"):
            fetch_category(client, "Q2925697")

    def test_no_value_on_another_property_does_not_hide_missing_winner(self):
        client = RDFClient("""
            wd:Q2925697 p:P1346 wds:Q2925697-incomplete .
            wds:Q2925697-incomplete a wdno:P2453 ;
                wikibase:rank wikibase:NormalRank .
        """)
        with self.assertRaisesRegex(ValueError, "Incomplete Wikidata statement page"):
            fetch_category(client, "Q2925697")

    def test_explicit_no_winner_does_not_fabricate_a_recipient_or_win(self):
        from unittest.mock import Mock

        import mongomock
        from f.awards.wikidata import normalize

        client = RDFClient("""
            wd:Q2925697 p:P1346 wds:Q2925697-no-winner .
            wds:Q2925697-no-winner a wdno:P1346 ;
                wikibase:rank wikibase:NormalRank .
        """)
        rows = fetch_category(client, "Q2925697")
        metadata = Mock()
        metadata.entities.return_value = {
            "Q2925697": {
                "claims": {
                    "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q1369077"}}}}]
                },
                "labels": {
                    "en": {"value": "British Academy Television Award for Best Actress"}
                },
            }
        }
        observations = normalize(
            mongomock.MongoClient().db,
            metadata,
            Mock(),
            {"program_key": "bafta.tv", "qid": "Q2925697"},
            rows,
        )
        self.assertEqual(observations, [])


if __name__ == "__main__":
    unittest.main()
