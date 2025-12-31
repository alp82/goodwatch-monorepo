# TODO chat: https://chatgpt.com/g/g-p-675ffbf7167881919f049695a263ca6c/c/68bc11c0-039c-8320-9d3c-3bb1e32a4cb9

import numpy as np
from f.db.cratedb import CrateConnector


def main(show_tmdb_ids=[1396, 71715, 1402, 64199]):
    connector = CrateConnector()

    # 1) Fetch seed vectors
    rows = connector.select(
        """
        SELECT tmdb_id, vector_fingerprint
        FROM show
        WHERE tmdb_id = ANY(?)
        """,
        (show_tmdb_ids,),
    )

    vectors = np.array([np.array(r["vector_fingerprint"], dtype=float) for r in rows])
    centroid = vectors.mean(axis=0).astype(float)
    centroid_list = centroid.tolist()

    # 2) Single-pass KNN with centroid.
    k = 200
    limit = 50
    results = connector.select(
        f"""
        WITH param AS (SELECT CAST(? AS FLOAT_VECTOR) AS v)
        SELECT
          s.tmdb_id,
          s.title,
          s.release_year,
          s.fingerprint_scores['crime']            AS crime_score,
          s.fingerprint_scores['tension']          AS tension_score,
          s.fingerprint_scores['dialogue_quality'] AS dialogue_quality_score,
          VECTOR_SIMILARITY(s.vector_fingerprint, (SELECT v FROM param)) AS score
        FROM show s
        WHERE KNN_MATCH(s.vector_fingerprint, (SELECT v FROM param), {k})
          AND s.goodwatch_overall_score_voting_count > 10000
          AND s.goodwatch_overall_score_normalized_percent > 50
        ORDER BY score DESC
        LIMIT {limit}
        """,
        (centroid_list,),
    )

    # (Optional) drop the seeds from the output:
    results = [r for r in results if r["tmdb_id"] not in show_tmdb_ids]

    for r in results:
        print(r)

    connector.disconnect()
    return results
