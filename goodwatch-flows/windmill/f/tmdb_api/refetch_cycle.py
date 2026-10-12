"""Every title's fixed place in the 30-day refetch cycle of the details queue.

docs/details-refetch-cycle.md. A title is fetched again when its second of the cycle
comes, whenever it was fetched last. The second follows from the TMDB id alone, so the
titles of a day are a thirtieth of the catalogue whatever happened before: titles that
were all fetched in one week do not come back as one week. The queue
(tmdb_fetch_details_from_api/next) keeps the time it has worked up to in one small
Mongo document and takes the titles of the seconds since then.
"""
from datetime import datetime, timedelta

from mongoengine import Document, Q

from f.data_source.common import QUEUE_FIELDS, not_deleted_filter

COLLECTION = "tmdb_details_refetch_cycle"
CYCLE = timedelta(days=30)
SECONDS = int(CYCLE.total_seconds())
# From one second to the next the id moves on by this much, modulo the seconds of a cycle.
# About 0.618 of a cycle, so the ids of any stretch of time are spread over the whole id
# range: old and new titles, well-known and obscure ones. It shares no factor with
# SECONDS, so every id has exactly one second.
STEP = 1_601_501
# A run works at most this far through the cycle. Between two runs lie 15 seconds;
# after an outage the queue catches up at 20 times that, as far as its batches have room.
SECONDS_PER_RUN = 300
# A title fetched this recently is left out: an awaited title is fetched every day
# (docs/awaited-title-rechecks.md), and a new title may have been fetched hours before its second.
FETCHED_RECENTLY = timedelta(days=1)
EPOCH = datetime(1970, 1, 1)


def ids_due(second: int, highest_id: int) -> list[int]:
    """The TMDB ids whose place in the cycle is this second (counted from 1970), up to highest_id."""
    return list(range(second % SECONDS * STEP % SECONDS, highest_id + 1, SECONDS))


def highest_tmdb_id(model: Document) -> int:
    newest = model.objects.order_by("-tmdb_id").only("tmdb_id").first()
    return newest.tmdb_id if newest else 0


def titles_due(db, models: list[Document], room: int, now: datetime) -> list[Document]:
    """Take the titles whose second came since the last run, earliest first, and remember how far that was.

    Seconds are taken whole and only while the batch has room; the rest waits for the
    next run, so no title is passed. Only the first second is taken even when it holds
    more titles than there is room for. The first run ever takes nothing: the cycle starts with it.
    """
    state = db[COLLECTION]
    until = int((now - EPOCH).total_seconds())
    stored = state.find_one({"_id": "details"})
    if stored is None:
        state.insert_one({"_id": "details", "worked_until": EPOCH + timedelta(seconds=until)})
        return []
    worked_until = max(int((stored["worked_until"] - EPOCH).total_seconds()), until - SECONDS)
    until = min(until, worked_until + SECONDS_PER_RUN)
    if room <= 0 or until <= worked_until:
        return []

    due = []
    for model in models:
        highest_id = highest_tmdb_id(model)
        second_of = {
            tmdb_id: second
            for second in range(worked_until + 1, until + 1)
            for tmdb_id in ids_due(second, highest_id)
        }
        fetched_before = now - FETCHED_RECENTLY
        titles = model.objects(
            Q(tmdb_id__in=list(second_of)) & Q(selected_at__lt=fetched_before) & not_deleted_filter(model)
        ).only(*QUEUE_FIELDS)
        due += [(second_of[title.tmdb_id], title) for title in titles]
    due.sort(key=lambda entry: entry[0])

    if len(due) > room:
        first_second, waiting_second = due[0][0], due[room][0]
        until = max(waiting_second - 1, first_second)
    state.update_one({"_id": "details"}, {"$set": {"worked_until": EPOCH + timedelta(seconds=until)}})
    return [title for second, title in due if second <= until]


def main():
    pass
