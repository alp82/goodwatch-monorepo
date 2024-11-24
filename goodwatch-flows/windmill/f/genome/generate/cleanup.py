from datetime import datetime
from typing import Union

from mongoengine import get_db
from pymongo import UpdateOne
from pymongo.collection import Collection

from f.db.mongodb import init_mongodb, close_mongodb
from f.genome.generate.fetch import capitalize_value, is_valid_value
from f.genome.models import GenomeMovie, GenomeTv


BATCH_SIZE = 5000


def cleanup_entry(next_entry: Union[GenomeMovie, GenomeTv]):
    dna = next_entry.get("dna")

    seen = set()
    return {
        key: [
            capitalize_value(value)
            for value in values
            if is_valid_value(key, value, seen)
        ]
        for key, values in (dna or {}).items()
    }


def build_operation(genome_entry: Union[GenomeMovie, GenomeTv]):
    date_now = datetime.utcnow()
    dna_cleaned = cleanup_entry(genome_entry)

    update_fields = {
        "dna_cleaned": dna_cleaned,
        "updated_at": date_now,
    }

    operation = UpdateOne(
        {
            "tmdb_id": genome_entry.get("tmdb_id"),
        },
        {"$setOnInsert": {"created_at": date_now}, "$set": update_fields},
        upsert=True,
    )
    return operation


def store_copies(
    operations: list[UpdateOne],
    collection: Collection,
) -> dict[str, int]:
    collection.bulk_write(operations)

    count_updated_documents = 0
    for op in operations:
        criteria = op._filter
        found_docs = collection.count_documents(criteria)
        count_updated_documents += found_docs

    return {
        "count_updated_documents": count_updated_documents,
    }


def run_batch_dna_cleanup():
    mongo_db = get_db()

    filter_query = {"dna": {"$ne": None}}

    total_movies = mongo_db.genome_movie.count_documents(filter_query)
    total_tv = mongo_db.genome_tv.count_documents(filter_query)
#    total_movies = 0
#    total_tv = 0

    print(f"Total movie objects with dna: {total_movies}")
    print(f"Total tv objects with dna: {total_tv}")

    movie_upserts = {
        "count_updated_documents": 0,
    }
    tv_upserts = {
        "count_updated_documents": 0,
    }

    for start in range(0, total_movies, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_movies)
        print(f"Processing movies {start} to {end}")

        genome_movie_cursor = (
            mongo_db.genome_movie.find(filter_query).skip(start).limit(BATCH_SIZE)
        )

        movie_operations = []
        for genome_movie in genome_movie_cursor:
            operation = build_operation(genome_entry=genome_movie)
            movie_operations.append(operation)

        upserts = store_copies(
            operations=movie_operations,
            collection=mongo_db.genome_movie,
        )
        movie_upserts["count_updated_documents"] += upserts.get(
            "count_updated_documents", 0
        )

    for start in range(0, total_tv, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total_tv)
        print(f"Processing tv {start} to {end}")

        genome_tv_cursor = (
            mongo_db.genome_tv.find(filter_query).skip(start).limit(BATCH_SIZE)
        )

        tv_operations = []
        for genome_tv in genome_tv_cursor:
            operation = build_operation(genome_entry=genome_tv)
            tv_operations.append(operation)

        upserts = store_copies(
            operations=tv_operations,
            collection=mongo_db.genome_tv,
        )
        tv_upserts["count_updated_documents"] += upserts.get(
            "count_updated_documents", 0
        )

    return {
        "movie_upserts": movie_upserts,
        "tv_upserts": tv_upserts,
    }


def override_dna_with_cleaned():
    mongo_db = get_db()

    collections = [mongo_db.genome_movie, mongo_db.genome_tv]
    for collection in collections:
        print(f"Overriding dna with cleaned version for {collection.name}")
        filter_query = {"dna_cleaned": {"$exists": True}}
        collection.update_many(
            filter_query,
            [
                {"$set": {
                    "dna_old": "$dna",
                    "dna": "$dna_cleaned",
                }}
            ]
        )



def main():
    init_mongodb()
    result = run_batch_dna_cleanup()
    override_dna_with_cleaned()
    close_mongodb()
    return result
