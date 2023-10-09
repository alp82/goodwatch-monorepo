from datetime import datetime
import json
import pymongo
import wmill

from f.tmdb_daily.models import (
    TmdbDailyDumpAvailability,
    DumpType,
    TmdbDailyDumpData,
    MediaType,
)
from f.db.mongodb import init_mongodb
from f.utils.file import unzip_json
from f.utils.web import fetch_file_from_url


BATCH_SIZE = 50000


def get_daily_dump_infos() -> list[TmdbDailyDumpAvailability]:
    print("Checking if new dumps are available for processing")

    daily_dump_infos = []
    for dump_type in [DumpType.MOVIES.value, DumpType.TV_SERIES.value]:
        latest_daily_dump = (
            TmdbDailyDumpAvailability.objects(
                type=dump_type,
                finished_at=None,
            )
            .order_by("-day")
            .first()
        )

        if latest_daily_dump:
            daily_dump_infos.append(latest_daily_dump)

    if not len(daily_dump_infos):
        print("No new daily dump available")

    return daily_dump_infos


def prepare_data(dump_data, dump_type: DumpType):
    media_type = MediaType.MOVIE if dump_type == DumpType.MOVIES else MediaType.TV

    rows = dump_data.split("\n")
    converted_rows = []
    for row in rows:
        if not len(row):
            continue
        json_row = json.loads(row)
        tmdb_data = TmdbDailyDumpData(
            tmdb_id=json_row.get("id"),
            type=media_type,
            original_title=json_row.get("original_title")
            if dump_type == DumpType.MOVIES
            else json_row.get("original_name"),
            popularity=json_row.get("popularity"),
            adult=json_row.get("adult", False),
            video=json_row.get("video", False),
            updated_at=datetime.utcnow(),
        )
        converted_rows.append(tmdb_data)
    return converted_rows


def download_zip_and_store_in_db(daily_dump_availability: TmdbDailyDumpAvailability):
    daily_dump_availability.started_at = datetime.utcnow
    daily_dump_availability.save()

    print(f"Starting dump download for {daily_dump_availability.type}")
    response = fetch_file_from_url(daily_dump_availability.url)

    print(f"Unzipping gzipped dump for {daily_dump_availability.type}")
    dump_data = unzip_json(response)
    if not dump_data:
        # TODO use this as generic exception handler for task
        error_message = (
            f"Daily dump could not be downloaded from: {daily_dump_availability.url}"
        )
        daily_dump_availability.failed_at = datetime.utcnow
        daily_dump_availability.error_message = error_message
        daily_dump_availability.save()
        raise Exception(error_message)

    prepared_data = prepare_data(dump_data, dump_type=daily_dump_availability.type)
    print(f"Storing {len(prepared_data)} rows for {daily_dump_availability.type}")
    operations = [
        pymongo.UpdateOne(
            {
                "tmdb_id": tmdb_dump.tmdb_id,
                "type": tmdb_dump.type.value,
            },
            {
                "$setOnInsert": {"created_at": tmdb_dump.updated_at},
                "$set": tmdb_dump.to_mongo(),
            },
            upsert=True,
        )
        for tmdb_dump in prepared_data
    ]
    for start in range(0, len(operations), BATCH_SIZE):
        end = min(start + BATCH_SIZE, len(operations))
        print(f"storing {start} to {end} for {daily_dump_availability.type}")
        batch = operations[start:end]
        bulk_result = TmdbDailyDumpData._get_collection().bulk_write(batch)
    print(f"Successfully saved tmdb daily dump data for {daily_dump_availability.type}")

    daily_dump_availability.finished_at = datetime.utcnow
    daily_dump_availability.row_count = len(prepared_data)
    daily_dump_availability.save()


def tmdb_extract_daily_dump_data():
    print("Checking TMDB for latest daily dumps")
    init_mongodb()

    daily_dump_infos = get_daily_dump_infos()
    for daily_dump_info in daily_dump_infos:
        download_zip_and_store_in_db(daily_dump_info)
    
    return [info.model_dump() for info in daily_dump_infos]


def main():
    return tmdb_extract_daily_dump_data()
