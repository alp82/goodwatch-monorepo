import re
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from mongoengine import get_db
from pydantic import BaseModel

from f.db.cratedb import CrateConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
    build_query_selector_for_object_ids,
)
from f.sync.copy.deleted_titles import (
    NOT_DELETED_FILTER,
    delete_titles_from_crate,
    find_flagged_tmdb_ids,
)
from f.sync.models.crate_models import (
    Movie,
    Show,
    MovieSeries,
    Season,
    Image,
    Video,
    AlternativeTitle,
    Translation,
    ReleaseEvent,
    ProductionCompany,
    Network,
    Person,
    PersonAppearedIn,
    PersonWorkedOn,
)
from f.sync.models.crate_schemas import SCHEMAS

BATCH_SIZE = 15000
SUB_BATCH_SIZE = 50000
HOURS_TO_FETCH = 24*2
# Shows per stale season delete; their current season ids travel in the same statement.
STALE_SEASON_SHOWS_PER_DELETE = 500


CREATOR_JOB = "Creator"

IMDB_TITLE_ID = re.compile(r"tt\d+")
# TMDB details are the only source of a title's IMDb id, so this copy clears
# them when TMDB has none. Other writers leave them to COALESCE.
IMDB_ID_COLUMNS = ("imdb_id", "imdb_url")


# ===== Helper Functions =====

def imdb_title(tmdb_details: dict, is_movie: bool) -> tuple[Optional[str], Optional[str]]:
    """The IMDb title id and link of a TMDB details document, or (None, None).

    Movies carry the id at the top level, shows in `external_ids`. Anything that
    is not a title id (missing, empty, "None", a person id) yields no link.
    """
    raw = tmdb_details.get("imdb_id") if is_movie else (tmdb_details.get("external_ids") or {}).get("imdb_id")
    if not isinstance(raw, str) or not IMDB_TITLE_ID.fullmatch(raw.strip()):
        return None, None
    imdb_id = raw.strip()
    return imdb_id, f"https://www.imdb.com/title/{imdb_id}"


def creator_credits(tmdb_details: dict, media_id: str) -> list[tuple[Person, PersonWorkedOn]]:
    """A show's `created_by` as person rows and Creator crew credits.

    TMDB lists a show's creators apart from its crew, so the crew copy never sees them.
    Each creator becomes a person_worked_on row with the job "Creator", keyed by the
    created_by credit id. The department stays NULL like every other show crew row,
    because aggregate credits carry no department per job.
    """
    crew = tmdb_details.get("credits", {}).get("crew", []) or tmdb_details.get("aggregate_credits", {}).get("crew", [])
    # A credit id the crew copy already writes must not reach the same upsert twice.
    seen_credit_ids = {member.get("credit_id") for member in crew} | {
        job.get("credit_id") for member in crew for job in member.get("jobs", [])
    }
    credits = []
    for creator in tmdb_details.get("created_by") or []:
        person_id = creator.get("id")
        name = creator.get("name")
        credit_id = creator.get("credit_id")
        if not (person_id and name and credit_id) or credit_id in seen_credit_ids:
            continue
        seen_credit_ids.add(credit_id)
        credits.append((
            Person(
                tmdb_id=person_id,
                name=name,
                original_name=creator.get("original_name"),
                profile_path=creator.get("profile_path"),
                gender=creator.get("gender"),
            ),
            PersonWorkedOn(
                media_tmdb_id=media_id,
                media_type="show",
                person_tmdb_id=person_id,
                credit_id=credit_id,
                job=CREATOR_JOB,
            ),
        ))
    return credits


def to_timestamp(dt_input: str) -> Optional[float]:
    """Convert datetime to Unix timestamp."""
    if isinstance(dt_input, datetime):
        return dt_input.timestamp()
    if isinstance(dt_input, str):
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%dT%H:%M:%S.%fZ')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d %H:%M:%S.%f')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d %H:%M:%S UTC')
            return dt.timestamp()
        except Exception:
            pass
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%d')
            return dt.timestamp()
        except Exception:
            pass

        raise Exception(f"cannot convert datetime to timestamp: {dt_input}")
        


def upsert_in_batches(connector: CrateConnector, table: str, records: list[BaseModel],
                      replace_null_columns: tuple[str, ...] = ()):
    """Process and insert entities and return upsert results."""
    total_result = {"records_received": 0, "rows_upserted": 0}
    
    if records:
        print(f"    Upserting {len(records)} of type {table}")
        for i in range(0, len(records), SUB_BATCH_SIZE):
            batch = records[i:i + SUB_BATCH_SIZE]
            if batch:
                result = connector.upsert_many(
                    table=table,
                    records=batch,
                    conflict_columns=SCHEMAS[table]["primary_key"],
                    silent=True,
                    replace_null_columns=replace_null_columns,
                )
                total_result["records_received"] += result["records_received"]
                total_result["rows_upserted"] += result["rows_upserted"]
    
    return total_result

def listed_season_ids(tmdb_details: dict) -> list[int]:
    """The season ids a TMDB show payload lists, or [] when it lists none."""
    return [season["id"] for season in tmdb_details.get("seasons") or [] if season.get("id")]


def delete_stale_seasons(connector: CrateConnector, season_ids_by_show: dict[int, list[int]]) -> int:
    """Delete the season rows of these shows whose ids TMDB no longer lists.

    The season key is the TMDB season id, so a season TMDB re-creates under a new id
    leaves its old row behind unless it is deleted here. Callers pass only shows whose
    payload lists at least one season, so a partial fetch never wipes a show's seasons.
    """
    show_ids = sorted(season_ids_by_show)
    deleted = 0
    for i in range(0, len(show_ids), STALE_SEASON_SHOWS_PER_DELETE):
        batch = show_ids[i:i + STALE_SEASON_SHOWS_PER_DELETE]
        kept_ids = sorted({season_id for show_id in batch for season_id in season_ids_by_show[show_id]})
        connector.run(
            "DELETE FROM season WHERE show_id = ANY(?) AND NOT (tmdb_id = ANY(?))",
            (batch, kept_ids),
        )
        deleted += max(connector.cur.rowcount or 0, 0)
    if deleted:
        connector.run("REFRESH TABLE season")
        print(f"    Deleted {deleted} stale seasons of {len(show_ids)} shows", flush=True)
    return deleted


def copy_media(
    connector: CrateConnector, 
    query_selector: dict = {},
    media_type: str = "movie",
    *, recent_only: bool = True,
):
    is_movie = media_type == "movie"

    mongo_db = get_db()
    mongo_collection = mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    media_table_name = 'movie' if is_movie else 'show'
    MediaClass = Movie if is_movie else Show

    updated_at_filter = {"updated_at": {"$gte": datetime.utcnow() - timedelta(hours=HOURS_TO_FETCH)}}
    if not recent_only:
        updated_at_filter = {}
    # Titles deleted on TMDB are removed from CrateDB instead of upserted. Every flagged
    # title is checked, not only the recent window, so a missed run or a racing publisher heals.
    flagged_ids = find_flagged_tmdb_ids(mongo_collection, query_selector)
    deleted_titles = delete_titles_from_crate(connector, media_type, flagged_ids)

    copy_filter = query_selector | updated_at_filter | NOT_DELETED_FILTER
    total_entry_count = mongo_collection.count_documents(copy_filter)
    print(f"Total {media_type} entries: {total_entry_count}")

    start = 0
    entity_counts = defaultdict(lambda: {"records_received": 0, "rows_upserted": 0})
    entity_ids = defaultdict(set)
    stale_seasons_deleted = 0
    
    projection = {
        "_id": 0,
        "vote_average": 0,
        "vote_count": 0,
    }
    
    while True:
        media_documents = []
        entity_batches = defaultdict(list)
        season_ids_by_show = {}

        tmdb_details_batch = list(
            #mongo_collection.find({"tmdb_id": 217} | updated_at_filter, projection)
            #mongo_collection.find({"tmdb_id": {"$lt": 1000}} | updated_at_filter, projection)
            mongo_collection.find(copy_filter, projection)
                .sort("tmdb_id", 1)
                .skip(start)
                .limit(BATCH_SIZE)
        )
        if not tmdb_details_batch:
            break

        # Insert batch of media
        print(f"\nBatch from {start} to {start + len(tmdb_details_batch)} {media_type}s")

        media_ids = []
        for index, tmdb_details in enumerate(tmdb_details_batch):
            tmdb_id = tmdb_details["tmdb_id"]
            media_id = str(tmdb_id)

            title = tmdb_details.get("title")
            original_title = tmdb_details.get("original_title")
            if not title and not original_title:
                continue
            
            if media_id in media_ids:
                continue
            
            media_ids.append(media_id)

            release_date = tmdb_details.get("release_date" if is_movie else "first_air_date")
            release_year = release_date.year if release_date else None
           
            # Tags
            genres = tmdb_details.get("genres", [])
            keywords = tmdb_details.get("keywords", [])

            # Streaming
            tmdb_url = f"https://www.themoviedb.org/{media_type}/{tmdb_id}"
            imdb_id, imdb_url = imdb_title(tmdb_details, is_movie)
            
            # Scores
            tmdb_vote_count = tmdb_details.get("vote_count")
            tmdb_user_score_rating_count = tmdb_vote_count if tmdb_vote_count else None
            tmdb_user_score = tmdb_details.get("vote_average")
            tmdb_user_score_original = tmdb_user_score if tmdb_user_score else None
            tmdb_user_score_normalized_percent = (
                tmdb_user_score * 10 if tmdb_user_score else None
            )

            # Create Media document
            media = MediaClass(
                tmdb_id=tmdb_id,
                title=title,
                original_title=original_title,
                tagline=tmdb_details.get("tagline"),
                synopsis=tmdb_details.get("overview"),

                popularity=tmdb_details.get("popularity"),
                status=tmdb_details.get("status"),
                adult=tmdb_details.get("adult"),
                poster_path=tmdb_details.get("poster_path"),
                backdrop_path=tmdb_details.get("backdrop_path"),
                release_year=release_year,
                budget=tmdb_details.get("budget"),
                revenue=tmdb_details.get("revenue"),

                genres=[genre.get("name") for genre in genres if genre.get("name")],
                keywords=[keyword.get("name") for keyword in keywords if keyword.get("name")],

                homepage=tmdb_details.get("homepage"),
                imdb_id=imdb_id,
                wikidata_id=tmdb_details.get("wikidata_id"),
                facebook_id=tmdb_details.get("facebook_id"),
                instagram_id=tmdb_details.get("instagram_id"),
                twitter_id=tmdb_details.get("twitter_id"),
                
                # Production info
                production_company_ids=[
                    company.get("id") for company in tmdb_details.get("production_companies", [])
                    if company.get("id")
                ],
                production_country_codes=[
                    country.get("iso_3166_1") for country in tmdb_details.get("production_countries", [])
                    if country.get("iso_3166_1")
                ],
                origin_country_codes=tmdb_details.get("origin_country"),
                original_language_code=tmdb_details.get("original_language"),
                spoken_language_codes=[
                    lang.get("iso_639_1") for lang in tmdb_details.get("spoken_languages", [])
                    if lang.get("iso_639_1")
                ],
                
                # Scores
                tmdb_url=tmdb_url,
                tmdb_user_score_original=tmdb_user_score_original,
                tmdb_user_score_normalized_percent=tmdb_user_score_normalized_percent,
                tmdb_user_score_rating_count=tmdb_user_score_rating_count,
                imdb_url=imdb_url,

                # Similarity & Recommendations
                tmdb_recommendation_ids=[
                    rec.get("id") for rec in tmdb_details.get("recommendations", {}).get("results", [])
                    if rec.get("id")
                ],
                tmdb_similar_ids=[
                    sim.get("id") for sim in tmdb_details.get("similar", {}).get("results", [])
                    if sim.get("id")
                ],

                # Metadata timestamps
                tmdb_details_created_at=to_timestamp(tmdb_details.get("created_at")),
                tmdb_details_updated_at=to_timestamp(tmdb_details.get("updated_at")),
            )

            # Movie and Show specific fields
            if is_movie:
                media.release_date = to_timestamp(release_date)
                media.movie_series_id = tmdb_details.get("belongs_to_collection", {}).get("id")
                media.runtime = tmdb_details.get("runtime")
            else:
                media.first_air_date = to_timestamp(tmdb_details.get("first_air_date"))
                media.last_air_date = to_timestamp(tmdb_details.get("last_air_date"))
                media.number_of_seasons = tmdb_details.get("number_of_seasons")
                media.number_of_episodes = tmdb_details.get("number_of_episodes")
                media.episode_runtime = tmdb_details.get("episode_run_time")
                media.in_production = tmdb_details.get("in_production")
                media.network_ids = [
                    network.get("id") for network in tmdb_details.get("networks", [])
                    if network.get("id")
                ]


            # Process movie collection (movies only)
            if is_movie and tmdb_details.get("belongs_to_collection"):
                collection_data = tmdb_details["belongs_to_collection"]
                collection_id = collection_data.get("id")
                collection_name = collection_data.get("name", "")
                if collection_id and collection_name:
                    if collection_id not in entity_ids["movie_series"]:
                        entity_ids["movie_series"].add(collection_id)
                        entity_batches['movie_series'].append(MovieSeries(
                            tmdb_id=collection_id,
                            name=collection_name,
                            poster_path=collection_data.get("poster_path"),
                            backdrop_path=collection_data.get("backdrop_path"),
                        ))
            
            # Process seasons (shows only)
            if not is_movie and (season_ids := listed_season_ids(tmdb_details)):
                season_ids_by_show[int(tmdb_id)] = season_ids
                for season in tmdb_details["seasons"]:
                    season_id = season.get("id")
                    if season_id:
                        season_number = season.get("season_number")
                        entity_batches['season'].append(Season(
                            tmdb_id=season_id,
                            show_id=media_id,
                            season_number=season_number,
                            name=season.get("name", f"Season {season_number}"),
                            air_date=to_timestamp(season.get("air_date")),
                            episode_count=season.get("episode_count"),
                            overview=season.get("overview"),
                            poster_path=season.get("poster_path"),
                            vote_average=season.get("vote_average"),
                        ))
            
            # Process images
            image_keys = set()
            for image_type, images in tmdb_details.get("images", {}).items():
                for image in images:
                    url_path = image.get("file_path")
                    if url_path:
                        # Existing CrateDB image keys use an empty string for
                        # language-neutral artwork; primary keys cannot be NULL.
                        language_code = image.get("iso_639_1") or ""
                        image_key = (media_id, media_type, image_type, url_path, language_code)
                        if image_key not in image_keys:
                            image_keys.add(image_key)
                            entity_batches['media_image'].append(Image(
                                media_tmdb_id=media_id,
                                media_type=media_type,
                                image_type=image_type,
                                url_path=url_path,
                                language_code=language_code,
                                aspect_ratio=image.get("aspect_ratio"),
                                width=image.get("width"),
                                height=image.get("height"),
                                tmdb_vote_average=image.get("vote_average"),
                                tmdb_vote_count=image.get("vote_count"),
                            ))
            
            # Process videos
            for video in tmdb_details.get("videos", []):
                video_id = video.get("id")
                site = video.get("site")
                site_key = video.get("key")
                if video_id and site and site_key:
                    entity_batches['media_video'].append(Video(
                        media_tmdb_id=media_id,
                        media_type=media_type,
                        tmdb_id=video_id,
                        video_type=video.get("type"),
                        site=site,
                        site_key=site_key,
                        language_code=video.get("iso_639_1"),
                        country_code=video.get("iso_3166_1"),
                        name=video.get("name"),
                        size=video.get("size"),
                        official=video.get("official"),
                        published_at=to_timestamp(video.get("published_at")),
                    ))
            
            # Process production companies
            for company in tmdb_details.get("production_companies", []):
                company_id = company.get("id")
                company_name = company.get("name")
                if company_id and company_name:
                    if company_id not in entity_ids["production_company"]:
                        entity_ids["production_company"].add(company_id)
                        entity_batches['production_company'].append(ProductionCompany(
                            tmdb_id=company_id,
                            name=company_name,
                            logo_path=company.get("logo_path"),
                            origin_country=company.get("origin_country"),
                        ))
            
            # Process networks (only shows)
            for network in tmdb_details.get("networks", []):
                network_id = network.get("id")
                network_name = network.get("name")
                if network_id and network_name:
                    if network_id not in entity_ids["network"]:
                        entity_ids["network"].add(network_id)
                        entity_batches['network'].append(Network(
                            tmdb_id=network_id,
                            name=network_name,
                            logo_path=network.get("logo_path"),
                            origin_country=network.get("origin_country"),
                        ))

            # Process alternative titles
            alt_title_keys = set()
            for alt_title in tmdb_details.get("alternative_titles", []):
                alt_title_text = alt_title.get("title", "")
                country_code = alt_title.get("iso_3166_1", "")
                if alt_title_text and country_code:
                    alt_title_key = (media_id, media_type, country_code)
                    if alt_title_key not in alt_title_keys:
                        alt_title_keys.add(alt_title_key)
                        entity_batches['alternative_title'].append(AlternativeTitle(
                            media_tmdb_id=media_id,
                            media_type=media_type,
                            country_code=country_code,
                            title=alt_title_text,
                        ))
            
            # Process translations
            for translation in tmdb_details.get("translations", []):
                lang = translation.get("iso_639_1", "")
                country_code = translation.get("iso_3166_1", "")
                data = translation.get("data")
                if lang and country_code:
                    entity_batches['translation'].append(Translation(
                        media_tmdb_id=media_id,
                        media_type=media_type,
                        language_code=lang,
                        country_code=country_code,
                        name=translation.get("name"),
                        english_name=translation.get("english_name"),
                        title=data.get("title"),
                        overview=data.get("overview"),
                        tagline=data.get("tagline"),
                        homepage=data.get("homepage"),
                        runtime=data.get("runtime"),
                    ))
            
            # Process release events and age classifications (only movies)
            certifications = set()
            for country_data in tmdb_details.get("release_dates", {}).get("results", []):
                country_code = country_data.get("iso_3166_1")
                if country_code:
                    for release in country_data.get("release_dates", []):
                        # Unrated releases still have a non-null CrateDB key.
                        certification = release.get("certification") or ""
                        if certification:
                            certifications.add(f"{country_code}_{certification}")
                        release_date = release.get("release_date")
                        release_type = release.get("type")
                        if release_date and release_type:
                            entity_batches['release_event'].append(ReleaseEvent(
                                media_tmdb_id=media_id,
                                media_type=media_type,
                                country_code=country_code,
                                release_type=release_type,
                                release_date=to_timestamp(release_date),
                                certification=certification,
                                note=release.get("note"),
                                descriptors=release.get("descriptors", []),
                            ))
            # Process age classifications (only shows)
            for content_rating in tmdb_details.get("content_ratings", []):
                country_code = content_rating.get("iso_3166_1")
                certification = content_rating.get("rating")
                if country_code and certification:
                    certifications.add(f"{country_code}_{certification}")
            media.age_certifications = list(certifications)
            
            # Process cast (appeared_in)
            cast_members = tmdb_details.get("credits", {}).get("cast", []) or tmdb_details.get("aggregate_credits", {}).get("cast", [])
            for cast_member in cast_members:
                person_id = cast_member.get("id")
                person_name = cast_member.get("name")
                if person_id and person_name:
                    if person_id not in entity_ids["person"]:
                        entity_ids["person"].add(person_id)
                        entity_batches['person'].append(Person(
                            tmdb_id=person_id,
                            name=person_name,
                            original_name=cast_member.get("original_name"),
                            profile_path=cast_member.get("profile_path"),
                            popularity=cast_member.get("popularity"),
                            adult=cast_member.get("adult"),
                            gender=cast_member.get("gender"),
                            known_for_department=cast_member.get("known_for_department"),
                        ))
                    roles = cast_member.get("roles", [])
                    credit_id = cast_member.get("credit_id")
                    character = cast_member.get("character")
                    if credit_id and character:
                        roles.append({
                            "credit_id": credit_id,
                            "character": character,
                        })
                    for role in roles:
                        entity_batches['person_appeared_in'].append(PersonAppearedIn(
                            media_tmdb_id=media_id,
                            media_type=media_type,
                            person_tmdb_id=person_id,
                            credit_id=role.get("credit_id"),
                            character=role.get("character"),
                            order_default=cast_member.get("order"),
                            episode_count_character=role.get("episode_count"),
                            episode_count_total=cast_member.get("total_episode_count"),
                        ))
            
            # Process crew (worked_on)
            #person_worked_on_keys = set()
            crew_members = tmdb_details.get("credits", {}).get("crew", []) or tmdb_details.get("aggregate_credits", {}).get("crew", [])
            for crew_member in crew_members:
                person_id = crew_member.get("id")
                person_name = crew_member.get("name")
                if person_id and person_name:
                    if person_id not in entity_ids["person"]:
                        entity_ids["person"].add(person_id)
                        entity_batches['person'].append(Person(
                            tmdb_id=person_id,
                            name=person_name,
                            original_name=crew_member.get("original_name"),
                            profile_path=crew_member.get("profile_path"),
                            popularity=crew_member.get("popularity"),
                            adult=crew_member.get("adult"),
                            gender=crew_member.get("gender"),
                            known_for_department=crew_member.get("known_for_department"),
                        ))

                    jobs = crew_member.get("jobs", [])
                    credit_id = crew_member.get("credit_id")
                    job = crew_member.get("job")
                    department = crew_member.get("department")
                    if credit_id and job:
                        jobs.append({
                            "credit_id": credit_id,
                            "job": job,
                            "department": department,
                        })
                    #person_worked_on_key = (media_id, media_type, person_id, credit_id)
                    #if person_worked_on_key not in person_worked_on_keys:
                        #person_worked_on_keys.add(person_worked_on_key)
                    for job in jobs:
                        entity_batches['person_worked_on'].append(PersonWorkedOn(
                            media_tmdb_id=media_id,
                            media_type=media_type,
                            person_tmdb_id=person_id,
                            credit_id=job.get("credit_id"),
                            job=job.get("job"),
                            department=job.get("department"),
                            episode_count_job=job.get("episode_count"),
                            episode_count_total=crew_member.get("total_episode_count"),
                        ))

            # Process creators (shows only). Crew people come first, so their fuller
            # person records win over the creator's.
            if not is_movie:
                for person, worked_on in creator_credits(tmdb_details, media_id):
                    if person.tmdb_id not in entity_ids["person"]:
                        entity_ids["person"].add(person.tmdb_id)
                        entity_batches['person'].append(person)
                    entity_batches['person_worked_on'].append(worked_on)

            # Streaming children and aggregates belong exclusively to the shared
            # tmdb_streaming reconciler. Unset model fields remain NULL and normal
            # upserts preserve their previously published values.
            media_documents.append(media)
            

        upsert_result = upsert_in_batches(
            connector=connector,
            table=media_table_name,
            records=media_documents,
            replace_null_columns=IMDB_ID_COLUMNS,
        )
        
        media_type_key = 'movies' if is_movie else 'shows'
        entity_counts[media_type_key]["records_received"] += upsert_result["records_received"]
        entity_counts[media_type_key]["rows_upserted"] += upsert_result["rows_upserted"]
        
        # Insert all row for batch and track counts
        for table_name, batch in entity_batches.items():
            entity_upsert_result = upsert_in_batches(
                connector=connector,
                table=table_name,
                records=batch, 
            )
            entity_counts[table_name]["records_received"] += entity_upsert_result["records_received"]
            entity_counts[table_name]["rows_upserted"] += entity_upsert_result["rows_upserted"]

        if season_ids_by_show:
            stale_seasons_deleted += delete_stale_seasons(connector, season_ids_by_show)

        start += BATCH_SIZE

    entity_counts["deleted_titles"] = deleted_titles
    if not is_movie:
        entity_counts["stale_seasons"] = {"rows_deleted": stale_seasons_deleted}
    return entity_counts


def main(movie_ids: list[str] = [], show_ids: list[str] = [], skip_movies = False):
    init_mongodb()
    connector = CrateConnector()

    results = {}

    if skip_movies:
        results["movies"] = None
    else:
        # Process movies
        if movie_ids is None or len(movie_ids) == 0:
            print("Processing all movies...")
            movie_query_selector = {}
        else:
            movie_query_selector = build_query_selector_for_object_ids(ids=movie_ids)
        
        results["movies"] = copy_media(
            connector=connector, 
            query_selector=movie_query_selector,
            media_type="movie"
        )
    
    # Process shows
    if show_ids is None or len(show_ids) == 0:
        print("\nProcessing all shows...")
        show_query_selector = {}
    else:
        show_query_selector = build_query_selector_for_object_ids(ids=show_ids)
    
    results["shows"] = copy_media(
        connector=connector, 
        query_selector=show_query_selector,
        media_type="show"
    )

    connector.disconnect()
    close_mongodb()
    
    return results


if __name__ == "__main__":
    main()
