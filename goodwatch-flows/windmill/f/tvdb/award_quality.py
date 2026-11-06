"""Source observations are not authoritative award totals or reviewed editorial notes."""

from collections import Counter

from f.sync.copy.sync_state import utc_now


def annotate(rows, current_year=None):
    current_year = current_year or utc_now().year
    duplicates = Counter(row["dedupe_key"] for row in rows)
    for row in rows:
        year = row["ceremony_year"]
        valid_year = (
            len(year) == 4
            and year.isascii()
            and year.isdecimal()
            and 1888 <= int(year) <= current_year
        )
        flags = ["incomplete_coverage"]
        if not valid_year:
            flags.append("invalid_ceremony_year")
        if duplicates[row["dedupe_key"]] > 1:
            flags.append("apparent_duplicate")
        if row.get("details"):
            flags.append("unreviewed_details")
        row.update(
            ceremony_year_valid=valid_year,
            display_eligible=valid_year and row["title_link_status"] == "verified",
            quality_flags=flags,
        )
    return rows


# One observation per title/award/category/year. Preserve separate winner and nomination
# signals: a title can legitimately have multiple nominees within the same category.
# Free-text details and apparent-duplicate rows are retained in the source table only.
DISPLAY_VIEW_SQL = """CREATE OR REPLACE VIEW tvdb_award_display AS
SELECT media_type, media_tmdb_id, award_id, award_name, category_id, category_name,
       ceremony_year,
       MAX(CASE WHEN is_winner THEN 1 ELSE 0 END) = 1 AS has_win,
       MAX(CASE WHEN NOT is_winner THEN 1 ELSE 0 END) = 1 AS has_nomination,
       COUNT(*) AS source_row_count,
       'partial' AS coverage_status,
       false AS totals_available
FROM tvdb_nomination
WHERE display_eligible = true AND title_link_status = 'verified' AND ceremony_year_valid = true
GROUP BY media_type, media_tmdb_id, award_id, award_name, category_id, category_name, ceremony_year
"""


def main():
    """Importable award quality and public projection contract."""
