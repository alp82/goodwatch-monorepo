# extra_requirements:
# requests
# pymongo
# mongoengine
# crate
# pydantic
# wmill

"""Crawl one title's Metacritic page now, for `f/priority/crawl_all` (#152).

Plain HTTP from the title's known URL (Wikidata's, then the stored one), with the
shared pacing and block handling of `f/critic_sites`. A title without a usable URL
is skipped; nothing is guessed. A block is reported, not raised, so the flow does
not retry through it.
"""
from f.critic_sites.crawl import crawl_by_id


def main(next_id: dict):
    return crawl_by_id("metacritic", next_id)
