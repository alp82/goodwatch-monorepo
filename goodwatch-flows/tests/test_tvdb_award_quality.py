"""Public award observations cannot imply complete totals or count duplicate-looking rows twice."""

import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tvdb.award_quality import DISPLAY_VIEW_SQL, annotate


def source_row(year="2024", key="same", status="verified", details=None):
    return {
        "ceremony_year": year,
        "dedupe_key": key,
        "title_link_status": status,
        "details": details,
    }


class AwardQualityTests(unittest.TestCase):
    def test_invalid_years_cannot_be_displayed_and_raw_year_survives(self):
        for year in ["2027", "202", "200", "", "0000", "２０２４", "2024/25", "1887"]:
            with self.subTest(year=year):
                row = annotate([source_row(year)], 2026)[0]
                self.assertFalse(row["ceremony_year_valid"])
                self.assertFalse(row["display_eligible"])
                self.assertIn("invalid_ceremony_year", row["quality_flags"])
                self.assertEqual(row["ceremony_year"], year)
        self.assertTrue(annotate([source_row("2026")], 2026)[0]["display_eligible"])

    def test_future_year_becomes_eligible_on_next_annual_refresh(self):
        row = source_row("2027")
        annotate([row], 2026)
        self.assertFalse(row["display_eligible"])
        annotate([row], 2027)
        self.assertTrue(row["display_eligible"])
        self.assertNotIn("invalid_ceremony_year", row["quality_flags"])

    def test_invalid_identity_cannot_display_even_with_a_valid_year(self):
        for status in ["conflict", "unmapped", "missing_local_title"]:
            self.assertFalse(
                annotate([source_row(status=status)], 2026)[0]["display_eligible"]
            )

    def test_duplicate_candidates_are_flagged_but_source_rows_are_preserved(self):
        rows = [source_row(), source_row(), source_row(key="different-recipient")]
        annotate(rows, 2026)
        self.assertEqual(len(rows), 3)
        self.assertIn("apparent_duplicate", rows[0]["quality_flags"])
        self.assertIn("apparent_duplicate", rows[1]["quality_flags"])
        self.assertNotIn("apparent_duplicate", rows[2]["quality_flags"])

    def test_free_text_is_unreviewed_even_when_it_looks_plausible(self):
        for details in ["lol", "Happy", "Black-and-White"]:
            row = annotate([source_row(details=details)], 2026)[0]
            self.assertIn("unreviewed_details", row["quality_flags"])
            self.assertEqual(row["details"], details)
            self.assertIn("incomplete_coverage", row["quality_flags"])

    def test_display_groups_preserve_mixed_results_and_do_not_expose_notes_or_totals(
        self,
    ):
        db = sqlite3.connect(":memory:")
        self.addCleanup(db.close)
        db.execute("""CREATE TABLE tvdb_nomination (
            media_type TEXT, media_tmdb_id INTEGER, award_id INTEGER, award_name TEXT,
            category_id INTEGER, category_name TEXT, ceremony_year TEXT, is_winner BOOLEAN,
            display_eligible BOOLEAN, title_link_status TEXT, ceremony_year_valid BOOLEAN,
            details TEXT)""")
        values = ("movie", 872585, 1, "Oscars", 20, "Actor", "2024")
        for won in [True, True, False]:
            db.execute(
                "INSERT INTO tvdb_nomination VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                values + (won, True, "verified", True, "lol"),
            )
        for eligible, status, year_valid in [
            (False, "verified", False),
            (True, "conflict", True),
        ]:
            db.execute(
                "INSERT INTO tvdb_nomination VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    "movie",
                    999,
                    1,
                    "Oscars",
                    20,
                    "Actor",
                    "2027",
                    True,
                    eligible,
                    status,
                    year_valid,
                    "Happy",
                ),
            )
        db.execute(DISPLAY_VIEW_SQL.replace("CREATE OR REPLACE VIEW", "CREATE VIEW"))
        cursor = db.execute("SELECT * FROM tvdb_award_display")
        rows = [dict(zip([c[0] for c in cursor.description], row)) for row in cursor]
        self.assertEqual(len(rows), 1)
        self.assertEqual(
            (
                rows[0]["has_win"],
                rows[0]["has_nomination"],
                rows[0]["source_row_count"],
            ),
            (1, 1, 3),
        )
        self.assertEqual(rows[0]["coverage_status"], "partial")
        self.assertFalse(rows[0]["totals_available"])
        self.assertNotIn("details", rows[0])
        self.assertNotIn("total_wins", rows[0])
