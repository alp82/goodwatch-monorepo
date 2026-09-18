
import pytest
from pathlib import Path

@pytest.fixture
def roadmap_file():
    return Path('docs/living_roadmap.md')

@pytest.fixture
def load_roadmap_content(roadmap_file):
    return roadmap_file.read_text()

def test_roadmap_existence(roadmap_file):
    assert roadmap_file.exists(), "Living roadmap file does not exist."

def test_roadmap_content_updated(load_roadmap_content):
    assert "Current focus" in load_roadmap_content, "Roadmap missing 'Current focus' section."
    assert "Reassessing direction" in load_roadmap_content, "Roadmap missing 'Reassessing direction' section."
    assert "Out Of Scope" in load_roadmap_content, "Roadmap missing 'Out Of Scope' section."
    assert "Inbox" in load_roadmap_content, "Roadmap missing 'Inbox' section for new ideas."
