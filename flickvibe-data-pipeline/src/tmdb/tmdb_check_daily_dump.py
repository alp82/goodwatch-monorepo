from datetime import date, timedelta, datetime

from prefect import flow, get_run_logger, task
from pydantic import BaseModel
from src.tmdb.models import DumpType, TmdbDailyDump
from src.utils.db import init_db
from src.utils.web import url_exists
from typing_extensions import Optional, TypedDict

baseUrl = "http://files.tmdb.org/p/exports"


@task
def request_url(dump_type: DumpType, day: date):
    logger = get_run_logger()
    formatted_day = datetime.strftime(day, '%m_%d_%Y')
    url = f"{baseUrl}/{dump_type}_{formatted_day}.json.gz"
    exists = url_exists(url)
    if exists:
        logger.info(f"Dump for {day} exists: {url}")
    else:
        logger.info(f"Dump does not exist: {url}")
    return exists, url


class DumpInfo(BaseModel):
    type: DumpType
    url: str
    day: date


class LatestDumps(TypedDict):
    movie_ids: Optional[DumpInfo]
    tv_series_ids: Optional[DumpInfo]


@task
def store_result(latest_dumps: LatestDumps):
    logger = get_run_logger()

    for dump_info in [latest_dumps["movie_ids"], latest_dumps["tv_series_ids"]]:
        daily_dump = TmdbDailyDump.objects(
            type=dump_info.type,
            day=dump_info.day,
        ).upsert_one(
            url=dump_info.url,
        )

        if not daily_dump.started_at:
            logger.info(f"new daily dump info for {daily_dump.type.value} at {daily_dump.day}")


@flow
def tmdb_check_daily_dump():
    logger = get_run_logger()
    logger.info("Checking TMDB for latest daily dump")

    init_db()

    today = date.today()
    yesterday = today - timedelta(days=1)

    latest_dumps: LatestDumps = {
        "movie_ids": None,
        "tv_series_ids": None,
    }

    for dump_type in [DumpType.MOVIES.value, DumpType.TV_SERIES.value]:
        exists, url = request_url(
            dump_type=dump_type,
            day=today
        )
        if exists:
            latest_dumps[dump_type] = DumpInfo(
                type=dump_type,
                url=url,
                day=today,
            )
        else:
            exists, url = request_url(dump_type, yesterday)
            if exists:
                latest_dumps[dump_type] = DumpInfo(
                    type=dump_type,
                    url=url,
                    day=yesterday,
                )
            else:
                logger.error("TMDB dump does not exist for both today and yesterday")

    logger.info(f"latest dumps: {latest_dumps}")
    store_result(latest_dumps=latest_dumps)

    return latest_dumps


if __name__ == "__main__":
    tmdb_check_daily_dump()
