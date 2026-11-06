# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Dedicated schedule entry point, with an independent overlap guard."""

from f.tvdb.crawl import main as crawl


def main(max_minutes: float = 4, max_items: int = 1000):
    return crawl("mappings", max_minutes, max_items)
