"""grade6.py's compare and merge on this repository's arena (results/grading, results/grades.json), with the harness
and data from ARENA_DIR.

Usage (the arena's .venv): .venv/bin/python bench/parity/merge_grades.py compare|merge <tag>
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OURS = os.path.dirname(os.path.dirname(HERE))
ARENA = os.environ.get("ARENA_DIR", OURS)
sys.path.insert(0, os.path.join(ARENA, "harness"))

import grade6  # noqa: E402

grade6.G = os.path.join(OURS, "results", "grading")
grade6.GRADES = os.path.join(OURS, "results", "grades.json")

if __name__ == "__main__":
    cmd, tag = sys.argv[1], sys.argv[2]
    {"compare": grade6.compare, "merge": grade6.merge}[cmd](tag)
