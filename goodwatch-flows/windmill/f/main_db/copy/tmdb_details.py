from collections import defaultdict
from datetime import datetime, timedelta
import gc
from typing import Optional

from mongoengine import get_db

from f.db.arango import ArangoConnector
from f.db.mongodb import (
    init_mongodb,
    close_mongodb,
    build_query_selector_for_object_ids,
)
from f.main_db.config.graph import COLLECTIONS, EDGES
from f.main_db.models.arango import (
    BaseArangoModel,
    Edge,
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
    StreamingAvailability,
)

BATCH_SIZE = 3000
SUB_BATCH_SIZE = 10000

# TODO
"""
                tropes=[trope.get("name") for trope in tropes if trope.get("name")],

                is_anime=is_anime,
                production_method=production_info["method"] if production_info else None,
                animation_style=production_info["animation_style"] if production_info else None,

                DNA
                Scores
                Streaming
"""


# ===== Helper Functions =====

def to_timestamp(dt_input) -> Optional[float]:
    """Convert datetime to Unix timestamp."""
    if isinstance(dt_input, str):
        try:
            dt = datetime.strptime(dt_input, '%Y-%m-%dT%H:%M:%S.%fZ')
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


def fetch_all_documents_in_batch(tmdb_ids, collection):
    results = defaultdict(list)
    for doc in collection.find({"tmdb_id": {"$in": tmdb_ids}}):
        results[doc["tmdb_id"]].append(doc)
    return dict(results)
    

def process_and_insert_entities(entities_to_process: list[BaseArangoModel], connector: ArangoConnector, collection, entity_type: str):
    """Process and insert entities and return upsert results."""
    total_result = {"created": 0, "updated": 0, "ignored": 0}
    
    if entities_to_process:
        print(f"    Upserting {len(entities_to_process)} {entity_type}")
        for i in range(0, len(entities_to_process), SUB_BATCH_SIZE):
            sub_batch = entities_to_process[i:i + SUB_BATCH_SIZE]
            if sub_batch:
                result = connector.upsert_many(collection, sub_batch)
                total_result["created"] += result["created"]
                total_result["updated"] += result["updated"]
                total_result["ignored"] += result["ignored"]
    
    return total_result


def copy_media(
    connector: ArangoConnector, 
    query_selector: dict = {},
    media_type: str = "movie" 
):
    is_movie = media_type == "movie"

    mongo_db = get_db()
    mongo_collection = mongo_db.tmdb_movie_details if is_movie else mongo_db.tmdb_tv_details
    media_collection_name = COLLECTIONS['movies'] if is_movie else COLLECTIONS['shows']
    MediaClass = Movie if is_movie else Show

    updated_at_filter = {"updated_at": {"$gte": datetime.utcnow() - timedelta(hours=24 * 7)}}
    total_entry_count = mongo_collection.count_documents(query_selector | updated_at_filter)
    print(f"Total {media_type} entries: {total_entry_count}")

    collections = {}
    for name, collection_name_val in COLLECTIONS.items():
        collections[name] = connector.db.collection(collection_name_val)
    
    edge_collections = {}
    for edge_name, edge_config in EDGES.items():
        edge_collections[edge_name] = connector.db.collection(edge_config['name'])

    streaming_services = collections["streaming_services"].all()
    streaming_service_id_by_name = {
        streaming_service["name"]: streaming_service["tmdb_id"]
        for streaming_service in streaming_services
    }

    start = 0
    entity_counts = defaultdict(lambda: {"created": 0, "updated": 0, "ignored": 0})
    edge_counts = defaultdict(lambda: {"created": 0, "updated": 0, "ignored": 0})
    
    projection = {
        "_id": 0,
        "imdb_id": 0,
        "vote_average": 0,
        "vote_count": 0,
    }
    
    while True:
        media_documents = []
        entity_batches = defaultdict(list)
        edge_batches = defaultdict(list)

        tmdb_details_batch = list(
            #mongo_collection.find({"tmdb_id": {"$lt": 1000}} | updated_at_filter, projection)
            mongo_collection.find(query_selector | updated_at_filter, projection)
                .sort("tmdb_id", 1)
                .skip(start)
                .limit(BATCH_SIZE)
        )
        if not tmdb_details_batch:
            break

        tmdb_ids = [doc["tmdb_id"] for doc in tmdb_details_batch]
        tmdb_all_providers = fetch_all_documents_in_batch(
            tmdb_ids, 
            mongo_db.tmdb_movie_providers if is_movie else mongo_db.tmdb_tv_providers
        )

        for tmdb_details in tmdb_details_batch:
            tmdb_id = tmdb_details["tmdb_id"]
            media_key = str(tmdb_id)

            title = tmdb_details.get("title")
            original_title = tmdb_details.get("original_title")
            if not title and not original_title:
                continue
            
            release_date = tmdb_details.get("release_date" if is_movie else "first_air_date")
            release_year = release_date.year if release_date else None
           
            # Tags
            genres = tmdb_details.get("genres", [])
            keywords = tmdb_details.get("keywords", [])

            # Streaming
            tmdb_url = f"https://www.themoviedb.org/{media_type}/{tmdb_id}"
            imdb_id = tmdb_details.get("imdb_id")
            imdb_url = f"https://www.imdb.com/title/{imdb_id}"
            
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
                _key=media_key, 
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

            if is_movie:
                media.release_date = to_timestamp(release_date)
                media.runtime = tmdb_details.get("runtime")
            else:
                media.first_air_date = to_timestamp(tmdb_details.get("first_air_date"))
                media.last_air_date = to_timestamp(tmdb_details.get("last_air_date"))
                media.number_of_seasons = tmdb_details.get("number_of_seasons")
                media.number_of_episodes = tmdb_details.get("number_of_episodes")
                media.episode_runtime = tmdb_details.get("episode_run_time")

            # Process movie collection (movies only)
            unique_keys = []
            if is_movie and tmdb_details.get("belongs_to_collection"):
                collection_data = tmdb_details["belongs_to_collection"]
                collection_id = collection_data.get("id")
                collection_name = collection_data.get("name", "")
                if collection_id and collection_name:
                    collection_key = str(collection_id)
                    if collection_key not in unique_keys:
                        unique_keys.append(collection_key)
                        entity_batches['movie_series'].append(MovieSeries(
                            _key=collection_key, 
                            tmdb_id=collection_id,
                            name=collection_name,
                            poster_path=collection_data.get("poster_path"),
                            backdrop_path=collection_data.get("backdrop_path"),
                        ))
                    
                    edge_batches['movie_belongs_to_series'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['movie_series']}/{collection_key}",
                    })
            
            # Process seasons (shows only)
            if not is_movie and tmdb_details.get("seasons"):
                for season in tmdb_details["seasons"]:
                    season_id = season.get("id")
                    if season_id:
                        season_key = str(season_id)
                        season_number = season.get("season_number")
                        entity_batches['seasons'].append(Season(
                            _key=season_key, 
                            tmdb_id=season_id,
                            show_key=media_key,
                            season_number=season_number,
                            name=season.get("name", f"Season {season_number}"),
                            air_date=to_timestamp(season.get("air_date")),
                            episode_count=season.get("episode_count"),
                            overview=season.get("overview"),
                            poster_path=season.get("poster_path"),
                            tmdb_vote_average=season.get("vote_average"),
                        ))
                        
                        edge_batches['show_has_season'].append({
                            '_from': f"{media_collection_name}/{media_key}",
                            '_to': f"{COLLECTIONS['seasons']}/{season_key}",
                        })
            
            # Process images
            for image_type, images in tmdb_details.get("images", {}).items():
                for image in images:
                    url_path = image.get("file_path")
                    if url_path:
                        image_key = url_path.replace("/", "")
                        entity_batches['images'].append(Image(
                            _key=image_key, 
                            image_type=image_type,
                            url_path=url_path,
                            aspect_ratio=image.get("aspect_ratio"),
                            width=image.get("width"),
                            height=image.get("height"),
                            tmdb_vote_average=image.get("vote_average"),
                            tmdb_vote_count=image.get("vote_count"),
                        ))
                        
                        edge_batches['image_for'].append({
                            '_from': f"{media_collection_name}/{media_key}",
                            '_to': f"{COLLECTIONS['images']}/{image_key}",
                        })
            
            # Process videos
            for video in tmdb_details.get("videos", []):
                video_id = video.get("id")
                site = video.get("site")
                site_key = video.get("key")
                if video_id and site and site_key:
                    video_key = str(video_id)
                    entity_batches['videos'].append(Video(
                        _key=video_key, 
                        tmdb_id=video_id,
                        video_type=video.get("type"),
                        site=site,
                        site_key=site_key,
                        name=video.get("name"),
                        size=video.get("size"),
                        official=video.get("official"),
                        language=video.get("iso_639_1"),
                        country=video.get("iso_3166_1"),
                        published_at=to_timestamp(video.get("published_at")),
                    ))
                    
                    edge_batches['video_for'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['videos']}/{video_key}",
                    })
            
            # Process genres
            unique_keys = []
            for genre in genres:
                genre_id = genre.get("id")
                if genre_id:
                    genre_key = str(genre_id)
                    if genre_key not in unique_keys:
                        unique_keys.append(genre_key)
                        edge_batches['genre_for'].append({
                            '_from': f"{media_collection_name}/{media_key}",
                            '_to': f"{COLLECTIONS['genres']}/{genre_key}",
                        })
            
            # Process production companies
            unique_keys = []
            for company in tmdb_details.get("production_companies", []):
                company_id = company.get("id")
                company_name = company.get("name")
                if company_id and company_name:
                    company_key = str(company_id)
                    if company_key not in unique_keys:
                        unique_keys.append(company_key)
                        entity_batches['production_companies'].append(ProductionCompany(
                            _key=company_key, 
                            tmdb_id=company_id,
                            name=company_name,
                            logo_path=company.get("logo_path"),
                            origin_country=company.get("origin_country"),
                        ))
                    
                    edge_batches['production_company_produced'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['production_companies']}/{company_key}",
                    })
            
            # Process networks (only shows)
            unique_keys = []
            for network in tmdb_details.get("networks", []):
                network_id = network.get("id")
                network_name = network.get("name")
                if network_id and network_name:
                    network_key = str(network_id)
                    if network_key not in unique_keys:
                        unique_keys.append(network_key)
                        entity_batches['networks'].append(Network(
                            _key=network_key, 
                            tmdb_id=network_id,
                            name=network_name,
                            logo_path=network.get("logo_path"),
                            origin_country=network.get("origin_country"),
                        ))
                    
                    edge_batches['network_released'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['networks']}/{network_key}",
                    })

            # Process alternative titles
            unique_keys = []
            for alt_title in tmdb_details.get("alternative_titles", []):
                alt_title_text = alt_title.get("title", "")
                country_code = alt_title.get("iso_3166_1", "")
                if alt_title_text and country_code:
                    alt_title_key = f"{media_key}_{country_code}" 
                    if alt_title_key not in unique_keys:
                        unique_keys.append(alt_title_key)
                        entity_batches['alternative_titles'].append(AlternativeTitle(
                            _key=alt_title_key, 
                            title=alt_title_text,
                            country=country_code,
                        ))
                    
                    edge_batches['alternative_title_for'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['alternative_titles']}/{alt_title_key}",
                    })
            
            # Process translations
            unique_keys = []
            for translation in tmdb_details.get("translations", []):
                lang = translation.get("iso_639_1", "")
                country_code = translation.get("iso_3166_1", "")
                data = translation.get("data")
                if lang and country_code:
                    translation_key = f"{media_key}_{lang}_{country_code}"
                    if translation_key not in unique_keys:
                        unique_keys.append(translation_key)
                        entity_batches['translations'].append(Translation(
                            _key=translation_key, 
                            language=lang,
                            country=country_code,
                            name=translation.get("name"),
                            english_name=translation.get("english_name"),
                            title=data.get("title"),
                            overview=data.get("overview"),
                            tagline=data.get("tagline"),
                            homepage=data.get("homepage"),
                            runtime=data.get("runtime"),
                        ))
                    
                    edge_batches['translation_for'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['translations']}/{translation_key}",
                    })
            
            # Process release events and age classifications
            unique_keys = []
            for country_data in tmdb_details.get("release_dates", {}).get("results", []):
                country_code = country_data.get("iso_3166_1", "")
                for release in country_data.get("release_dates", []):
                    release_date = release.get("release_date")
                    release_type = release.get("type")
                    if release_date and release_type:
                        release_key = f"{media_key}_{country_code}_{release_type}"
                        if release_key not in unique_keys:
                            unique_keys.append(release_key)
                            certification = release.get("certification")
                            entity_batches['release_events'].append(ReleaseEvent(
                                _key=release_key, 
                                country=country_code,
                                release_type=release_type,
                                release_date=to_timestamp(release_date),
                                certification=certification,
                                note=release.get("note"),
                                descriptors=release.get("descriptors", []),
                            ))
                    
                        edge_batches['release_event_for'].append({
                            '_from': f"{media_collection_name}/{media_key}",
                            '_to': f"{COLLECTIONS['release_events']}/{release_key}",
                        })
                        
                        # Process age certification
                        if certification:
                            age_certification_key = f"{country_code}_{certification}_{media_type}"

                            edge_batches['age_certification_appropriate_for'].append({
                                '_from': f"{media_collection_name}/{media_key}",
                                '_to': f"{COLLECTIONS['age_certifications']}/{age_certification_key}",
                            })
            
            # Process cast (appeared_in)
            unique_keys = []
            for cast_member in tmdb_details.get("credits", {}).get("cast", []):
                person_id = cast_member.get("id")
                person_name = cast_member.get("name")
                if person_id and person_name:
                    person_key = str(person_id)
                    if person_key not in unique_keys:
                        unique_keys.append(person_key)
                        entity_batches['persons'].append(Person(
                            _key=person_key, 
                            tmdb_id=person_id,
                            name=person_name,
                            original_name=cast_member.get("original_name"),
                            profile_path=cast_member.get("profile_path"),
                            popularity=cast_member.get("popularity"),
                            adult=cast_member.get("adult"),
                            gender=cast_member.get("gender"),
                            known_for_department=cast_member.get("known_for_department"),
                        ))

                    edge_batches['person_appeared_in'].append({
                        '_from': f"{COLLECTIONS['persons']}/{person_key}",
                        '_to': f"{media_collection_name}/{media_key}",
                        'character': cast_member.get("character"),
                        'order': cast_member.get("order"),
                        'credit_id': cast_member.get("credit_id"),
                    })
            
            # Process crew (worked_on)
            for crew_member in tmdb_details.get("credits", {}).get("crew", []):
                person_id = crew_member.get("id")
                person_name = crew_member.get("name")
                if person_id and person_name:
                    person_key = str(person_id)
                    if person_key not in unique_keys:
                        unique_keys.append(person_key)
                        entity_batches['persons'].append(Person(
                            _key=person_key, 
                            tmdb_id=person_id,
                            name=person_name,
                            original_name=cast_member.get("original_name"),
                            profile_path=cast_member.get("profile_path"),
                            popularity=cast_member.get("popularity"),
                            adult=cast_member.get("adult"),
                            gender=cast_member.get("gender"),
                            known_for_department=cast_member.get("known_for_department"),
                        ))
                    
                    edge_batches['person_worked_on'].append({
                        '_from': f"{COLLECTIONS['persons']}/{person_key}",
                        '_to': f"{media_collection_name}/{media_key}",
                        'job': crew_member.get("job"),
                        'department': crew_member.get("department"),
                    })

            # Process streaming availability
            streaming_availabilities_to_add = {}
            watch_provider_results = tmdb_details.get("watch_providers", {}).get("results", {})
            if watch_provider_results:
                for country_code, streaming_data in watch_provider_results.items():
                    link = streaming_data.pop("link")
                    if link:
                        for streaming_type, streaming_list in streaming_data.items():
                            for streaming in streaming_list:
                                streaming_service_id = streaming.get("provider_id")
                                streaming_service_key = str(streaming_service_id)
                                streaming_key = f"{media_key}_{country_code}_{streaming_type}_{streaming_service_key}"
                                streaming_availabilities_to_add[streaming_key] = StreamingAvailability(
                                    _key=streaming_key, 
                                    country_code=country_code,
                                    streaming_type=streaming_type,
                                    streaming_service_id=streaming_service_id,
                                    display_priority=streaming.get("display_priority"),
                                    tmdb_link=link,
                                )
        
            tmdb_streaming_providers = tmdb_all_providers.get(tmdb_id, [])
            for tmdb_streaming_provider in tmdb_streaming_providers:
                country_code = tmdb_streaming_provider.get("country_code")
                for streaming_link in tmdb_streaming_provider.get("streaming_links", []):
                    streaming_service_id = streaming_service_id_by_name.get(streaming_link["provider_name"])
                    if streaming_service_id:
                        streaming_type = streaming_link["stream_type"]
                        streaming_key = f"{media_key}_{country_code}_{streaming_type}_{streaming_service_id}"
                        if streaming_key not in streaming_availabilities_to_add.keys():
                            streaming_availabilities_to_add[streaming_key] = StreamingAvailability(
                                _key=streaming_key, 
                                country_code=country_code,
                                streaming_type=streaming_type,
                                streaming_service_id=streaming_service_id,
                                stream_url=streaming_link.get("stream_url"),
                                price_dollar=streaming_link.get("price_dollar"),
                                quality=streaming_link.get("quality"),
                            )
                        else:
                            streaming_availabilities_to_add[streaming_key].stream_url = streaming_link.get("stream_url")
                            streaming_availabilities_to_add[streaming_key].price_dollar = streaming_link.get("price_dollar")
                            streaming_availabilities_to_add[streaming_key].quality = streaming_link.get("quality")

            streaming_availability_countries = []
            streaming_availability_services = []
            streaming_availability_combos = []
            for streaming_key, streaming_availability in streaming_availabilities_to_add.items():
                entity_batches['streaming_availabilities'].append(streaming_availability)
                edge_batches['streaming_availability_for'].append({
                    '_from': f"{media_collection_name}/{media_key}",
                    '_to': f"{COLLECTIONS['streaming_availabilities']}/{streaming_key}"
                })
                if streaming_availability.country_code not in streaming_availability_countries:
                    streaming_availability_countries.append(streaming_availability.country_code)
                    edge_batches['streaming_availability_in_country'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['countries']}/{streaming_availability.country_code}"
                    })
                if streaming_availability.streaming_service_id not in streaming_availability_services:
                    streaming_availability_services.append(streaming_availability.streaming_service_id)
                    edge_batches['streaming_service_is_available_for'].append({
                        '_from': f"{media_collection_name}/{media_key}",
                        '_to': f"{COLLECTIONS['streaming_services']}/{streaming_availability.streaming_service_id}"
                    })
                combo = f"{streaming_availability.country_code}_{streaming_availability.streaming_service_id}"
                if combo not in streaming_availability_combos:
                    streaming_availability_combos.append(combo)
            media.streaming_country_codes = streaming_availability_countries
            media.streaming_service_ids = streaming_availability_services
            media.streaming_availabilities = streaming_availability_combos
            
            media_documents.append(media)
            

        # Collect all referenced media IDs for this batch
        referenced_media_ids = set()
        for media_item in media_documents: 
            referenced_media_ids.update(media_item.tmdb_recommendation_ids)
            referenced_media_ids.update(media_item.tmdb_similar_ids)

        # Insert batch of media
        print(f"\nExecuting batch from {start} to {start + len(media_documents)} {media_type}s")
        
        media_for_upsert = []
        for media_item in media_documents: 
            media_dict = media_item.model_dump(
                by_alias=True, 
                exclude_none=True,
                exclude={
                    'tmdb_recommendation_ids', 
                    'tmdb_similar_ids',
                }
            )
            cleaned_media_instance = MediaClass(**media_dict)
            media_for_upsert.append(cleaned_media_instance)
        
        upsert_result = connector.upsert_many(
            collections[media_collection_name],
            media_for_upsert
        )
        
        # Track media counts
        media_type_key = 'movies' if is_movie else 'shows'
        entity_counts[media_type_key]["created"] += upsert_result["created"]
        entity_counts[media_type_key]["updated"] += upsert_result["updated"]
        entity_counts[media_type_key]["ignored"] += upsert_result["ignored"]
        
        # Insert all documents for batch and track counts
        print(f"\n  Upserting entities for {media_type}s:")
        for name, batch in entity_batches.items():
            result = process_and_insert_entities(
                batch, 
                connector,
                collections[name], 
                name.replace('_', ' '), 
            )
            # Accumulate node counts
            entity_counts[name]["created"] += result["created"]
            entity_counts[name]["updated"] += result["updated"]
            entity_counts[name]["ignored"] += result["ignored"]

        # Insert edges for batch and track counts
        print(f"\n  Upserting edges for {media_type}s:")
        for edge_type, edges_list in edge_batches.items():
            batch = [Edge(**edge_dict) for edge_dict in edges_list]
            result = process_and_insert_entities(
                batch,
                connector,
                edge_collections[edge_type],
                edge_type.replace('_', ' ')
            )
            # Accumulate edge counts
            edge_counts[edge_type]["created"] += result["created"]
            edge_counts[edge_type]["updated"] += result["updated"]
            edge_counts[edge_type]["ignored"] += result["ignored"]
        
        # Handle referenced media (recommendations and similar)
        if referenced_media_ids:
            print(f"\n  Processing {len(referenced_media_ids)} referenced {media_type}s...")
            
            # Fetch minimal data for referenced media from MongoDB
            referenced_media_data = list(
                mongo_collection.find(
                    {
                        "tmdb_id": {"$in": list(referenced_media_ids)}
                    }, {
                        "tmdb_id": 1,
                        "title": 1,
                        "original_title": 1,
                        "release_date" if is_movie else "first_air_date": 1,
                    }
                )
            )
            
            tmdb_id_to_key = {}
            minimal_media_list = []
            
            for ref_data in referenced_media_data:
                ref_tmdb_id = ref_data["tmdb_id"]
                ref_title = ref_data.get("title")
                ref_original_title = ref_data.get("original_title")
                ref_date = ref_data.get("release_date" if is_movie else "first_air_date")
                ref_year = ref_date.year if ref_date else None

                if not ref_title and not ref_original_title:
                    continue

                # Store the mapping
                tmdb_id_to_key[ref_tmdb_id] = ref_tmdb_id
                
                # Create minimal media document
                minimal_doc = MediaClass(
                    _key=str(ref_tmdb_id), 
                    tmdb_id=ref_tmdb_id,
                    title=ref_title,
                    original_title=ref_original_title,
                    release_year=ref_year,
                )
                minimal_media_list.append(minimal_doc)
            
            # Upsert minimal media (will only insert if they don't exist, or update if they do)
            if minimal_media_list:
                print(f"    Upserting {len(minimal_media_list)} minimal {media_type} records...")
                result = connector.upsert_many(
                    collections[media_collection_name],
                    minimal_media_list
                )
                # Track referenced media counts
                entity_counts[f"{media_type_key}_referenced"]["created"] += result["created"]
                entity_counts[f"{media_type_key}_referenced"]["updated"] += result["updated"]
                entity_counts[f"{media_type_key}_referenced"]["ignored"] += result["ignored"]
            
            # Now create recommendation and similar edges (only for media that exist)
            recommendation_edges = []
            similar_edges = []
            
            for media_item in media_documents: 
                media_item_key = media_item.doc_key 
                
                # Create recommendation edges
                for rec_id in media_item.tmdb_recommendation_ids:
                    if rec_id in tmdb_id_to_key:
                        recommendation_edges.append(Edge(
                            _from=f"{media_collection_name}/{media_item_key}", 
                            _to=f"{media_collection_name}/{tmdb_id_to_key[rec_id]}"  
                        ))
                
                # Create similar edges
                for sim_id in media_item.tmdb_similar_ids:
                    if sim_id in tmdb_id_to_key:
                        similar_edges.append(Edge(
                            _from=f"{media_collection_name}/{media_item_key}", 
                            _to=f"{media_collection_name}/{tmdb_id_to_key[sim_id]}"  
                        ))
            
            # Insert recommendation and similar edges
            if recommendation_edges:
                print(f"    Upserting {len(recommendation_edges)} recommendation edges...")
                result = connector.upsert_many(edge_collections['tmdb_recommends'], recommendation_edges)
                edge_counts['tmdb_recommends']["created"] += result["created"]
                edge_counts['tmdb_recommends']["updated"] += result["updated"]
                edge_counts['tmdb_recommends']["ignored"] += result["ignored"]
            
            if similar_edges:
                print(f"    Upserting {len(similar_edges)} similar edges...")
                result = connector.upsert_many(edge_collections['tmdb_similar_to'], similar_edges)
                edge_counts['tmdb_similar_to']["created"] += result["created"]
                edge_counts['tmdb_similar_to']["updated"] += result["updated"]
                edge_counts['tmdb_similar_to']["ignored"] += result["ignored"]
        
        del tmdb_details_batch
        del media_documents
        del entity_batches
        del edge_batches
        del media_for_upsert
        del referenced_media_ids
        del referenced_media_data
        del minimal_media_list
        del recommendation_edges
        del similar_edges
        gc.collect()

        start += BATCH_SIZE

    return {
        "entity_counts": dict(entity_counts),
        "edge_counts": dict(edge_counts),
    }


def print_summary(results):
    """Print a comprehensive summary of all entities and edges created/updated."""
    print("\n" + "="*80)
    print("MIGRATION SUMMARY")
    print("="*80)
    
    if results.get("movies"):
        print("\n🎬 MOVIES MIGRATION:")
        movie_results = results["movies"]
        
        # Entity summary
        print("\n📊 ENTITIES:")
        entity_counts = movie_results.get("entity_counts", {})
        total_entities = {"created": 0, "updated": 0, "ignored": 0}
        
        for entity_type, counts in sorted(entity_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {entity_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_entities["created"] += counts["created"]
                total_entities["updated"] += counts["updated"]
                total_entities["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL ENTITIES':<35} | "
              f"Created: {total_entities['created']:>9,} | "
              f"Updated: {total_entities['updated']:>9,} | "
              f"Ignored: {total_entities['ignored']:>9,}")
        
        # Edge summary
        print("\n🔗 EDGES:")
        edge_counts = movie_results.get("edge_counts", {})
        total_edges = {"created": 0, "updated": 0, "ignored": 0}
        
        for edge_type, counts in sorted(edge_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {edge_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_edges["created"] += counts["created"]
                total_edges["updated"] += counts["updated"]
                total_edges["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL EDGES':<35} | "
              f"Created: {total_edges['created']:>9,} | "
              f"Updated: {total_edges['updated']:>9,} | "
              f"Ignored: {total_edges['ignored']:>9,}")
    
    if results.get("shows"):
        print("\n\n📺 TV SHOWS MIGRATION:")
        show_results = results["shows"]
        
        # Entity summary
        print("\n📊 ENTITIES:")
        entity_counts = show_results.get("entity_counts", {})
        total_entities = {"created": 0, "updated": 0, "ignored": 0}
        
        for entity_type, counts in sorted(entity_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {entity_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_entities["created"] += counts["created"]
                total_entities["updated"] += counts["updated"]
                total_entities["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL ENTITIES':<35} | "
              f"Created: {total_entities['created']:>9,} | "
              f"Updated: {total_entities['updated']:>9,} | "
              f"Ignored: {total_entities['ignored']:>9,}")
        
        # Edge summary
        print("\n🔗 EDGES:")
        edge_counts = show_results.get("edge_counts", {})
        total_edges = {"created": 0, "updated": 0, "ignored": 0}
        
        for edge_type, counts in sorted(edge_counts.items()):
            if any(counts.values()):  # Only show if there are any counts
                print(f"  {edge_type.replace('_', ' ').title():<35} | "
                      f"Created: {counts['created']:>9,} | "
                      f"Updated: {counts['updated']:>9,} | "
                      f"Ignored: {counts['ignored']:>9,}")
                total_edges["created"] += counts["created"]
                total_edges["updated"] += counts["updated"]
                total_edges["ignored"] += counts["ignored"]
        
        print(f"  {'─'*35} | {'─'*18} | {'─'*18} | {'─'*18}")
        print(f"  {'TOTAL EDGES':<35} | "
              f"Created: {total_edges['created']:>9,} | "
              f"Updated: {total_edges['updated']:>9,} | "
              f"Ignored: {total_edges['ignored']:>9,}")
    
    # Overall totals
    print("\n\n📈 OVERALL TOTALS:")
    overall_entities = {"created": 0, "updated": 0, "ignored": 0}
    overall_edges = {"created": 0, "updated": 0, "ignored": 0}
    
    for result_type in ["movies", "shows"]:
        if results.get(result_type):
            result = results[result_type]
            for counts in result.get("entity_counts", {}).values():
                overall_entities["created"] += counts["created"]
                overall_entities["updated"] += counts["updated"]
                overall_entities["ignored"] += counts["ignored"]
            
            for counts in result.get("edge_counts", {}).values():
                overall_edges["created"] += counts["created"]
                overall_edges["updated"] += counts["updated"]
                overall_edges["ignored"] += counts["ignored"]
    
    print(f"  All Entities                  | "
          f"Created: {overall_entities['created']:>9,} | "
          f"Updated: {overall_entities['updated']:>9,} | "
          f"Ignored: {overall_entities['ignored']:>9,}")
    print(f"  All Edges                     | "
          f"Created: {overall_edges['created']:>9,} | "
          f"Updated: {overall_edges['updated']:>9,} | "
          f"Ignored: {overall_edges['ignored']:>9,}")
    
    grand_total = {
        "created": overall_entities["created"] + overall_edges["created"],
        "updated": overall_entities["updated"] + overall_edges["updated"],
        "ignored": overall_entities["ignored"] + overall_edges["ignored"]
    }
    
    print(f"  {'─'*29} | {'─'*18} | {'─'*18} | {'─'*18}")
    print(f"  {'GRAND TOTAL':<29} | "
          f"Created: {grand_total['created']:>9,} | "
          f"Updated: {grand_total['updated']:>9,} | "
          f"Ignored: {grand_total['ignored']:>9,}")
    

def main(movie_ids: list[str] = [], show_ids: list[str] = [], skip_movies = False):
    init_mongodb()

    connector = ArangoConnector()

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

    connector.close()
    close_mongodb()
    
    # Print comprehensive summary
    print_summary(results)
    
    return results


if __name__ == "__main__":
    main()