import json
from datetime import datetime

from prefect import flow, get_run_logger, task
from src.tmdb.models import TmdbDailyDump, DumpType
from src.utils.db import init_db
from src.utils.file import unzip_json
from src.utils.web import fetch_file_from_url


@task
def get_daily_dump_infos() -> list[TmdbDailyDump]:
    logger = get_run_logger()
    logger.info("checking if new dumps are available for processing")

    daily_dump_infos = []
    for dump_type in [DumpType.MOVIES.value, DumpType.TV_SERIES.value]:
        latest_daily_dump = TmdbDailyDump.objects(
            type=dump_type,
            # TODO remove comment
            # started_at=None,
        ).order_by("-day").first()

        if latest_daily_dump:
            daily_dump_infos.append(latest_daily_dump)

    return daily_dump_infos


@task
def download_csv_and_store_in_db(daily_dump: TmdbDailyDump):
    logger = get_run_logger()
    daily_dump.started_at = datetime.utcnow
    daily_dump.save()

    logger.info(f"starting dump download for {daily_dump.type}")
    response = fetch_file_from_url(daily_dump.url)

    logger.info(f"unzipping gzipped dump")
    dump_data = unzip_json(response)
    if not dump_data:
        # TODO use this as generic exception handler for task
        error_message = f"Daily dump could not be downloaded from: {daily_dump.url}"
        daily_dump.failed_at = datetime.utcnow
        daily_dump.error_message = error_message
        daily_dump.save()
        raise Exception(error_message)

    result = json.loads(f"[{dump_data}]")
    print(len(result))


@flow
def tmdb_check_daily_dump():
    logger = get_run_logger()
    logger.info("Checking TMDB for latest daily dumps")
    init_db()

    daily_dump_infos = get_daily_dump_infos()
    for daily_dump_info in daily_dump_infos:
        download_csv_and_store_in_db(daily_dump_info)


if __name__ == "__main__":
    tmdb_check_daily_dump()
