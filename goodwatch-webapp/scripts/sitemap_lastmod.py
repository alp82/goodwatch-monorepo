"""The date a title page was last changed, for <lastmod>. Kept apart from the generator so that it can be tested
without a database."""
from datetime import date, datetime, timezone
from typing import Optional

# Every title page was rebuilt and deployed on 2026-09-24/25, so each page changed on that day even when its data
# did not. Without this floor most titles would report an older date, and Google would see no reason to fetch the
# rebuilt page. Raise it to the deploy date when all title pages change again.
TITLE_PAGE_REBUILT_ON = date(2026, 9, 25)


def latest_date(*timestamps: Optional[int]) -> Optional[date]:
    """CrateDB returns timestamps as epoch milliseconds."""
    values = [t for t in timestamps if t is not None]
    if not values:
        return None
    return datetime.fromtimestamp(max(values) / 1000, tz=timezone.utc).date()


def title_lastmod(*timestamps: Optional[int]) -> date:
    """The later of the data's last change and the rebuild of the page itself."""
    data_changed_on = latest_date(*timestamps)
    if data_changed_on is None:
        return TITLE_PAGE_REBUILT_ON
    return max(data_changed_on, TITLE_PAGE_REBUILT_ON)
