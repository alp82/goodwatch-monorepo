from datetime import date, timedelta, datetime

from prefect import flow, get_run_logger, serve, task
from prefect.blocks.notifications import DiscordWebhook
from prefect_dask.task_runners import DaskTaskRunner
from pydantic import BaseModel
from src.tmdb_daily.models import DumpType, TmdbDailyDumpAvailability
from src.utils.db import init_db
from src.utils.web import url_exists
from typing_extensions import Optional, TypedDict

baseUrl = "http://files.tmdb.org/p/exports"


class DumpInfo(BaseModel):
    type: DumpType
    url: str
    day: date


class LatestDumps(TypedDict):
    movie_ids: Optional[DumpInfo]
    tv_series_ids: Optional[DumpInfo]


def check_availability_for_day(dump_type: DumpType, day: date) -> Optional[DumpInfo]:
    exists, url = request_url(
        dump_type=dump_type,
        day=day
    )
    if exists:
        return DumpInfo(
            type=dump_type,
            url=url,
            day=day,
        )


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


@task
def store_result(latest_dumps: LatestDumps):
    logger = get_run_logger()

    for dump_info in [latest_dumps["movie_ids"], latest_dumps["tv_series_ids"]]:
        if not dump_info:
            raise Exception(f"Dump info does not exist: {latest_dumps}")

        daily_dump = TmdbDailyDumpAvailability.objects(
            type=dump_info.type,
            day=dump_info.day,
        ).upsert_one(
            url=dump_info.url,
        )

        if not daily_dump.discovered_at:
            daily_dump.discovered_at = datetime.utcnow()
            daily_dump.save()
            logger.info(f"New daily dump info for {daily_dump.type} at {daily_dump.day}")
            discord_webhook_block = DiscordWebhook.load("flickvibe-data-pipeline")
            discord_webhook_block.notify(f"New daily dump available on TMDB for {daily_dump.type}")


@flow(task_runner=DaskTaskRunner())
def tmdb_check_daily_dump_availability():
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
        dump_info = check_availability_for_day(
            dump_type=dump_type,
            day=today
        )
        if dump_info:
            latest_dumps[dump_type] = dump_info
        else:
            latest_dumps[dump_type] = check_availability_for_day(
                dump_type=dump_type,
                day=yesterday
            )

        if not latest_dumps[dump_type]:
            raise Exception("TMDB dump does not exist for both today and yesterday")

    logger.info(f"Latest dumps: {latest_dumps}")
    store_result(latest_dumps=latest_dumps)

    return latest_dumps


if __name__ == "__main__":
    deployment = tmdb_check_daily_dump_availability.to_deployment(
        name="local",
        interval=60 * 30,
    )
    serve(deployment)
