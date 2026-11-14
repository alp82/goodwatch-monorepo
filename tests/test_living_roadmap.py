from pathlib import Path

import pytest

ROADMAP = Path(__file__).resolve().parent.parent / "docs" / "living-roadmap.md"

REQUIRED_SECTIONS = [
    "## Destination",
    "## Priority shortlist",
    "## Notes",
    "## Decisions so far",
    "## Current direction",
    "## Current focus",
    "## Existing evidence",
    "## How priorities will be proposed",
    "## Reassessing direction and refreshing research",
    "## Inbox",
    "## Area summaries",
    "## Reconciliation",
    "## Not yet specified",
    "## Out of scope",
    "## Related work already in GitHub",
    "## Complete backlog inventory",
]


@pytest.fixture(scope="module")
def roadmap_content():
    return ROADMAP.read_text(encoding="utf-8")


def test_roadmap_file_exists():
    assert ROADMAP.exists(), "docs/living-roadmap.md does not exist"


def test_roadmap_points_to_canonical_issue(roadmap_content):
    assert "issues/52" in roadmap_content


def test_roadmap_has_required_sections(roadmap_content):
    missing = [s for s in REQUIRED_SECTIONS if s not in roadmap_content]
    assert not missing, f"Roadmap is missing sections: {missing}"


def test_roadmap_priority_shortlist_is_ordered(roadmap_content):
    shortlist = roadmap_content.split("## Priority shortlist", 1)[1]
    shortlist = shortlist.split("## Notes", 1)[0]
    for rank in range(1, 23):
        assert f"\n{rank}. **" in shortlist, f"Priority shortlist missing rank {rank}"
