# extra_requirements:
# psycopg2-binary
from typing import Literal, Optional, Union

import pandas as pd
from psycopg2.extras import execute_values
import requests

from f.db.postgres import init_postgres

MAX_INPUT_LENGTH = 8192
LOG_BATCH_SIZE = 100
TABLE_NAME = Union[Literal["movies"], Literal["tv"]]

Version = Literal['v1', 'v2']


def get_medias_df(
    table_name: TABLE_NAME, tmdb_ids: Optional[list[str]] = None, start_offset: int = 0, exclude_existing: bool = False,
) -> pd.DataFrame:
    pg = init_postgres()
    base_query = f"""
    SELECT
        m.tmdb_id,
        m.title,
        m.release_year,
        m.cast,
        m.crew,
        m.trope_names,
        m.dna
    FROM
        {table_name} m
    WHERE
        (m.dna <> '{{}}'::jsonb
        OR m.trope_names <> '{{}}')
    """

    params = {}
    if tmdb_ids is not None:
        base_query += " AND m.tmdb_id = ANY(%(tmdb_ids)s)"
        params["tmdb_ids"] = [int(tmdb_id) for tmdb_id in tmdb_ids]

    if exclude_existing:
        media_type = "movie" if table_name == "movies" else "tv"
        base_query += f"""
        AND NOT EXISTS (
            SELECT 1 
            FROM vectors_media vm
            WHERE vm.tmdb_id = m.tmdb_id 
            AND vm.media_type = '{media_type}'
        )
        """

    # Add ORDER BY and OFFSET
    base_query += " ORDER BY m.popularity DESC OFFSET %(start_offset)s"
    params["start_offset"] = start_offset

    df = pd.read_sql_query(base_query, pg, params=params)
    pg.close()

    return df


def create_embeddings(text_dict: dict, version: Version = 'v1') -> dict:
    endpoint_path = 'embeddings' if version == 'v1' else 'v2/embeddings'

    # The embeddings server accepts a dict of key-text pairs
    response = requests.post(
        f"http://157.90.157.44:7997/{endpoint_path}",
        json=text_dict,
    )
    response.raise_for_status()
    embeddings_dict = response.json()  # result is a dict of key: embedding pairs
    return embeddings_dict


def build_limited_text(items, separator):
    """
    Builds a text string from a list of items without exceeding the MAX_INPUT_LENGTH.
    """
    limited_items = []
    total_length = 0
    separator_length = len(separator)

    for idx, item in enumerate(items):
        item_length = len(item)
        # Add separator length only if it's not the first item
        length_with_item = total_length + item_length + (separator_length if idx > 0 else 0)

        if length_with_item > MAX_INPUT_LENGTH:
            break

        limited_items.append(item)
        total_length = length_with_item

    return separator.join(limited_items)


def prepare_vectors_data(record: dict):
    # Initialize text_dict
    text_dict = {}

    # Process cast
    if record.get("cast"):
        cast_names = [item["name"] for item in record["cast"]]
        cast_text = build_limited_text(cast_names, ", ")
        text_dict["cast_vector"] = cast_text

    # Process crew
    if record.get("crew"):
        crew_names = [item["name"] for item in record["crew"]]
        crew_text = build_limited_text(crew_names, ", ")
        text_dict["crew_vector"] = crew_text

    # Process tropes
    if record.get("trope_names"):
        tropes_text = build_limited_text(record["trope_names"], "\n")
        text_dict["tropes_vector"] = tropes_text

    # Process DNA fields
    dna = record.get("dna", {})
    dna_categories = [
        "Sub-Genres",
        "Mood",
        "Themes",
        "Plot",
        "Cultural Impact",
        "Character Types",
        "Dialog",
        "Narrative",
        "Humor",
        "Pacing",
        "Time",
        "Place",
        "Cinematic Style",
        "Score and Sound",
        "Costume and Set",
        "Key Props",
        "Target Audience",
        "Flag",
    ]

    for category in dna_categories:
        if category in dna:
            category_items = dna[category]
            category_text = build_limited_text(category_items, ", ")
            key = f"{category.lower().replace(' ', '_').replace('-', '')}_vector"
            text_dict[key] = category_text

    # Combine DNA texts
    dna_texts = []
    total_length = 0
    separator_length = 1  # Length of '\n'

    for idx, category in enumerate(dna_categories):
        if category in dna:
            items_text = build_limited_text(dna[category], ", ")
            category_text = f"{category}: {items_text}"
            category_length = len(category_text) + (separator_length if idx > 0 else 0)

            if total_length + category_length > MAX_INPUT_LENGTH:
                break

            dna_texts.append(category_text)
            total_length += category_length

    if dna_texts:
        dna_text = "\n".join(dna_texts)
        text_dict["dna_vector"] = dna_text

    # Call create_embeddings with text_dict
    embeddings_dict = create_embeddings(text_dict)

    # Return the embeddings as vectors
    return embeddings_dict


def store_vectors(table_name: TABLE_NAME, df: pd.DataFrame) -> dict:
    pg = init_postgres()
    pg_cursor = pg.cursor()

    records = df.to_dict(orient="records")
    inserted_count = 0
    updated_count = 0
    error_count = 0
    errors = []

    for idx, record in enumerate(records):
        if idx % LOG_BATCH_SIZE == 0:
            print(
                f"Processing {table_name} {idx + 1} to {min(idx + LOG_BATCH_SIZE, len(records))}"
            )

        vectors_data = prepare_vectors_data(record)
        if not vectors_data:
            continue

        try:
            # Prepare the UPSERT query with RETURNING clause
            query = """
            INSERT INTO vectors_media (tmdb_id, media_type, cast_vector, crew_vector, tropes_vector, dna_vector, subgenres_vector,
                                       mood_vector, themes_vector, plot_vector, cultural_impact_vector, character_types_vector,
                                       dialog_vector, narrative_vector, humor_vector, pacing_vector, time_vector, place_vector,
                                       cinematic_style_vector, score_and_sound_vector, costume_and_set_vector, key_props_vector,
                                       target_audience_vector, flag_vector, updated_at)
            VALUES %s
            ON CONFLICT (tmdb_id, media_type)
            DO UPDATE SET
                cast_vector = EXCLUDED.cast_vector,
                crew_vector = EXCLUDED.crew_vector,
                tropes_vector = EXCLUDED.tropes_vector,
                dna_vector = EXCLUDED.dna_vector,
                subgenres_vector = EXCLUDED.subgenres_vector,
                mood_vector = EXCLUDED.mood_vector,
                themes_vector = EXCLUDED.themes_vector,
                plot_vector = EXCLUDED.plot_vector,
                cultural_impact_vector = EXCLUDED.cultural_impact_vector,
                character_types_vector = EXCLUDED.character_types_vector,
                dialog_vector = EXCLUDED.dialog_vector,
                narrative_vector = EXCLUDED.narrative_vector,
                humor_vector = EXCLUDED.humor_vector,
                pacing_vector = EXCLUDED.pacing_vector,
                time_vector = EXCLUDED.time_vector,
                place_vector = EXCLUDED.place_vector,
                cinematic_style_vector = EXCLUDED.cinematic_style_vector,
                score_and_sound_vector = EXCLUDED.score_and_sound_vector,
                costume_and_set_vector = EXCLUDED.costume_and_set_vector,
                key_props_vector = EXCLUDED.key_props_vector,
                target_audience_vector = EXCLUDED.target_audience_vector,
                flag_vector = EXCLUDED.flag_vector,
                updated_at = NOW()
            RETURNING (xmax = 0) AS inserted
            """

            values = (
                record["tmdb_id"],
                "movie" if table_name == "movies" else "tv",
                vectors_data.get("cast_vector"),
                vectors_data.get("crew_vector"),
                vectors_data.get("tropes_vector"),
                vectors_data.get("dna_vector"),
                vectors_data.get("subgenres_vector"),
                vectors_data.get("mood_vector"),
                vectors_data.get("themes_vector"),
                vectors_data.get("plot_vector"),
                vectors_data.get("cultural_impact_vector"),
                vectors_data.get("character_types_vector"),
                vectors_data.get("dialog_vector"),
                vectors_data.get("narrative_vector"),
                vectors_data.get("humor_vector"),
                vectors_data.get("pacing_vector"),
                vectors_data.get("time_vector"),
                vectors_data.get("place_vector"),
                vectors_data.get("cinematic_style_vector"),
                vectors_data.get("score_and_sound_vector"),
                vectors_data.get("costume_and_set_vector"),
                vectors_data.get("key_props_vector"),
                vectors_data.get("target_audience_vector"),
                vectors_data.get("flag_vector"),
                pd.Timestamp.utcnow(),
            )

            # Execute the INSERT query with fetch=True
            result = execute_values(pg_cursor, query, [values], fetch=True)
            # result is a list of tuples, each tuple containing the 'inserted' value
            inserted_flag = result[0][0]  # True if inserted, False if updated

            if inserted_flag:
                inserted_count += 1
            else:
                updated_count += 1

        except Exception as e:
            error_count += 1
            errors.append(str(e))
            # Optionally, you can continue to the next record instead of raising the exception
            # continue
            raise e

        # Commit the transaction after all inserts
        pg.commit()

    pg_cursor.close()
    pg.close()

    return {
        "inserted_row_count": inserted_count,
        "updated_row_count": updated_count,
        "error_count": error_count,
        "errors": errors,
    }


def main(media_type: str, tmdb_ids: Optional[list[str]] = None, start_offset: int = 0, exclude_existing: bool = False):
    # TODO remove this
    print("TODO: remove this script")
    return
    
    # Validate the collection_name to prevent SQL injection
    valid_tables = ["movies", "tv"]
    if media_type not in valid_tables:
        raise ValueError(f"Invalid media type: {media_type}")

    table_name = "movies" if media_type == "movies" else "tv"
    medias_df = get_medias_df(table_name=table_name, tmdb_ids=tmdb_ids, start_offset=start_offset, exclude_existing=exclude_existing)
    pd.set_option("display.max_columns", None)
    print(medias_df)

    result = store_vectors(
        table_name=table_name,
        df=medias_df,
    )

    return result
