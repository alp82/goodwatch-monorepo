import json
from collections import defaultdict

from mongoengine import get_db
from psycopg2.extras import execute_values

from f.db.mongodb import init_mongodb
from f.db.postgres import init_postgres, generate_upsert_query


BATCH_SIZE = 1000


def init_postgres_tables(pg):
    pg_cursor = pg.cursor()

    with open("./create_tv_table.pg.sql", "r") as f:
        create_table_query = f.read()

    pg_cursor.execute(create_table_query)
    pg.commit()


def fetch_documents_in_batch(tmdb_ids, collection):
    return {
        doc["tmdb_id"]: doc for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}})
    }


def copy_tv(pg):
    pg_cursor = pg.cursor()
    mongo_db = get_db()

    table_name = "tv"
    columns = [
        "tmdb_id",
        "original_title",
        "title",
        "tagline",
        "synopsis",
        "alternative_titles",
        "popularity",
        '"type"',  # needs to be enclosed because it's a reserved keyword
        "status",
        "in_production",
        "adult",
        "release_date",
        "release_year",
        "last_air_date",
        "last_air_year",
        "number_of_seasons",
        "number_of_episodes",
        "episode_runtime",
        "seasons",
        "network_ids",
        "production_company_ids",
        "certifications",
        '"cast"',  # needs to be enclosed because it's a reserved keyword
        "crew",
        "poster_path",
        "backdrop_path",
        "images",
        "videos",
        "origin_country_codes",
        "original_language_code",
        "spoken_language_codes",
        "production_country_codes",
        "translations",
        "genres",
        "keywords",
        "trope_names",
        "tropes",
        "streaming_providers",
        "tmdb_url",
        "tmdb_user_score_original",
        "tmdb_user_score_normalized_percent",
        "tmdb_user_score_rating_count",
        "imdb_url",
        "imdb_user_score_original",
        "imdb_user_score_normalized_percent",
        "imdb_user_score_rating_count",
        "metacritic_url",
        "metacritic_user_score_original",
        "metacritic_user_score_normalized_percent",
        "metacritic_user_score_rating_count",
        "metacritic_meta_score_original",
        "metacritic_meta_score_normalized_percent",
        "metacritic_meta_score_review_count",
        "rotten_tomatoes_url",
        "rotten_tomatoes_audience_score_original",
        "rotten_tomatoes_audience_score_normalized_percent",
        "rotten_tomatoes_audience_score_rating_count",
        "rotten_tomatoes_tomato_score_original",
        "rotten_tomatoes_tomato_score_normalized_percent",
        "rotten_tomatoes_tomato_score_review_count",
        "tmdb_recommendation_ids",
        "tmdb_similar_ids",
        "homepage",
        "freebase_mid",
        "freebase_id",
        "tvdb_id",
        "tvrage_id",
        "wikidata_id",
        "facebook_id",
        "instagram_id",
        "twitter_id",
        "created_at",
        "updated_at",
    ]

    start = 0
    total_count = 0

    while True:
        aggregated_data = []
        
        tmdb_details_batch = list(
            # mongo_db.tmdb_tv_details.find({"original_title": "Breaking Bad"})
            mongo_db.tmdb_tv_details.find()
            .skip(start)
            .limit(BATCH_SIZE)
        )
        if not tmdb_details_batch:
            break

        tmdb_ids = [doc["tmdb_id"] for doc in tmdb_details_batch]

        imdb_ratings = fetch_documents_in_batch(tmdb_ids, mongo_db.imdb_tv_rating)
        metacritic_ratings = fetch_documents_in_batch(
            tmdb_ids, mongo_db.metacritic_tv_rating
        )
        rotten_tomatoes_ratings = fetch_documents_in_batch(
            tmdb_ids, mongo_db.rotten_tomatoes_tv_rating
        )
        tv_tropes_tags = fetch_documents_in_batch(
            tmdb_ids, mongo_db.tv_tropes_tv_tags
        )

        for tmdb_details in tmdb_details_batch:
            tmdb_id = tmdb_details["tmdb_id"]

            release_date = tmdb_details.get("first_air_date")
            release_year = release_date.year if release_date else None
            last_air_date = tmdb_details.get("last_air_date")
            last_air_year = last_air_date.year if last_air_date else None

            grouped_certifications = defaultdict(list)
            for certification in tmdb_details.get("content_ratings", []):
                certification_type = certification.get('iso_3166_1', 'unknown')
                grouped_certifications[certification_type].append(certification)

            grouped_videos = defaultdict(list)
            for video in tmdb_details.get("videos", []):
                video_type = f"{video.get('type', 'unknown').lower()}s"
                grouped_videos[video_type].append(video)

            tmdb_user_score = tmdb_details.get("vote_average")
            imdb_rating = imdb_ratings.get(tmdb_id, {})
            imdb_id = imdb_rating.get("imdb_id", None)
            metacritic_rating = metacritic_ratings.get(tmdb_id, {})
            rotten_tomatoes_rating = rotten_tomatoes_ratings.get(tmdb_id, {})
            data = (
                tmdb_id,
                tmdb_details.get("original_title"),
                tmdb_details.get("title"),
                tmdb_details.get("tagline"),
                tmdb_details.get("overview"),
                json.dumps(tmdb_details.get("alternative_titles")),
                tmdb_details.get("popularity"),
                tmdb_details.get("type"),
                tmdb_details.get("status"),
                tmdb_details.get("in_production", False),
                tmdb_details.get("adult"),
                release_date,
                release_year,
                last_air_date,
                last_air_year,
                tmdb_details.get("number_of_seasons"),
                tmdb_details.get("number_of_episodes"),
                tmdb_details.get("episode_run_time"),
                json.dumps(tmdb_details.get("seasons")),
                [
                    network.get("id")
                    for network in tmdb_details.get("networks", [])
                ],
                [
                    company.get("id")
                    for company in tmdb_details.get("production_companies", [])
                ],
                json.dumps(
                    grouped_certifications,
                    sort_keys=True,
                    default=str,
                ),
                json.dumps(
                    [
                        {k: person.get(k) for k in ["id", "roles", "total_episode_count"]}
                        for person in tmdb_details.get("aggregate_credits", {}).get("cast", [])
                    ],
                    sort_keys=True,
                    default=str,
                ),
                json.dumps(
                    [
                        {k: person.get(k) for k in ["id", "jobs", "total_episode_count"]}
                        for person in tmdb_details.get("aggregate_credits", {}).get("crew", [])
                    ],
                    sort_keys=True,
                    default=str,
                ),
                tmdb_details.get("poster_path"),
                tmdb_details.get("backdrop_path"),
                json.dumps(tmdb_details.get("images")),
                json.dumps(grouped_videos),
                tmdb_details.get("origin_country"),
                tmdb_details.get("original_language"),
                [
                    country.get("iso_639_1")
                    for country in tmdb_details.get("spoken_languages", [])
                ],
                [
                    country.get("iso_3166_1")
                    for country in tmdb_details.get("production_countries", [])
                ],
                json.dumps(tmdb_details.get("translations", [])),
                [genre["name"] for genre in tmdb_details.get("genres", [])],
                [keyword["name"] for keyword in tmdb_details.get("keywords", [])],
                [
                    trope["name"]
                    for trope in tv_tropes_tags.get(tmdb_id, {}).get("tropes", [])
                ],
                json.dumps(tv_tropes_tags.get(tmdb_id, {}).get("tropes", [])),
                json.dumps(tmdb_details.get("watch_providers", {}).get("results", {})),
                f"https://www.themoviedb.org/tv/{tmdb_id}",
                tmdb_user_score,
                tmdb_user_score * 10 if tmdb_user_score else None,
                tmdb_details.get("vote_count"),
                f"https://www.imdb.com/title/{imdb_id}/" if imdb_id else None,
                imdb_rating.get("user_score_original", None),
                imdb_rating.get("user_score_normalized_percent", None),
                imdb_rating.get("user_score_vote_count", None),
                metacritic_rating.get("metacritic_url", None),
                metacritic_rating.get("user_score_original", None),
                metacritic_rating.get("user_score_normalized_percent", None),
                metacritic_rating.get("user_score_vote_count", None),
                metacritic_rating.get("meta_score_original", None),
                metacritic_rating.get("meta_score_normalized_percent", None),
                metacritic_rating.get("meta_score_vote_count", None),
                rotten_tomatoes_rating.get("rotten_tomatoes_url", None),
                rotten_tomatoes_rating.get("audience_score_original", None),
                rotten_tomatoes_rating.get("audience_score_normalized_percent", None),
                rotten_tomatoes_rating.get("audience_score_vote_count", None),
                rotten_tomatoes_rating.get("tomato_score_original", None),
                rotten_tomatoes_rating.get("tomato_score_normalized_percent", None),
                rotten_tomatoes_rating.get("tomato_score_vote_count", None),
                [
                    tv.get("id")
                    for tv in tmdb_details.get("recommendations", {}).get(
                        "results", []
                    )
                ],
                [
                    tv.get("id")
                    for tv in tmdb_details.get("similar", {}).get("results", [])
                ],
                tmdb_details.get("homepage"),
                tmdb_details.get("external_ids", {}).get("freebase_mid"),
                tmdb_details.get("external_ids", {}).get("freebase_id"),
                tmdb_details.get("external_ids", {}).get("tvdb_id"),
                tmdb_details.get("external_ids", {}).get("tvrage_id"),
                tmdb_details.get("external_ids", {}).get("wikidata_id"),
                tmdb_details.get("external_ids", {}).get("facebook_id"),
                tmdb_details.get("external_ids", {}).get("instagram_id"),
                tmdb_details.get("external_ids", {}).get("twitter_id"),
                tmdb_details.get("created_at"),
                tmdb_details.get("updated_at"),
            )
            aggregated_data.append(data)

        print(f"executing batch from {start} to {start + len(aggregated_data)} tv shows")
        query = generate_upsert_query(table_name, columns)
        execute_values(pg_cursor, query, aggregated_data)

        try:
            pg.commit()
            total_count += len(aggregated_data)
        except Exception as e:
            print("An error occurred:", e)
            pg.rollback()

        start += BATCH_SIZE

    pg_cursor.close()
    return {
        "total_count": total_count
    }


def main():
    init_mongodb()
    pg = init_postgres()
    result = copy_tv(pg)
    pg.close()
    return result


if __name__ == "__main__":
    pg = init_postgres()
    init_postgres_tables(pg=pg)
    main()
    pg.close()
