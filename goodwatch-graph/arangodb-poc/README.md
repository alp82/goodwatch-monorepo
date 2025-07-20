# Example Queries

Fetch movies + shows with streaming availability filtered by country and service:
```sql
WITH top_10_media AS (
  SELECT
    tmdb_id,
    popularity,
    title,
    'movie' AS media_type
  FROM
    movie
  WHERE
    'DE_8' = ANY (streaming_availabilities)
  UNION ALL
  SELECT
    tmdb_id,
    popularity,
    title,
    'show' AS media_type
  FROM
    show
  WHERE
    'DE_8' = ANY (streaming_availabilities)
  ORDER BY
    popularity DESC
  LIMIT
    10
)

SELECT
  t.tmdb_id AS id,
  t.title,
  t.popularity,
  ARRAY_AGG(
    {
      "media_tmdb_id" = sa.media_tmdb_id,
      "media_type" = sa.media_type,
      "country_code" = sa.country_code,
      "streaming_type" = sa.streaming_type,
      "streaming_service_id" = sa.streaming_service_id,
      "display_priority" = sa.display_priority,
      "tmdb_link" = sa.tmdb_link,
      "stream_url" = sa.stream_url,
      "price_dollar" = sa.price_dollar,
      "quality" = sa.quality
    }
  ) AS availability_in_country
FROM
  top_10_media AS t
  LEFT JOIN streaming_availability AS sa
      ON t.tmdb_id = sa.media_tmdb_id
      AND t.media_type = sa.media_type
      AND sa.country_code = 'DE'
      AND sa.streaming_service_id = 8
GROUP BY
  t.tmdb_id,
  t.title,
  t.popularity
ORDER BY
  t.popularity DESC;
```

Similar to star wars by fingerprint:
```sql
SELECT
  tmdb_id AS _key,
  title,
  _score
FROM
  movie
WHERE
  KNN_MATCH(
    vector_fingerprint,
    (SELECT vector_fingerprint FROM movie WHERE tmdb_id = 11),
    2
  )
  AND essence_text IS NOT NULL
  AND tmdb_id != 11
ORDER BY
  _score DESC
LIMIT 10;
```

Similar to star wars by fingerprint (movies and shows):
```sql
WITH similar_movies AS (
  SELECT
    tmdb_id AS _key,
    title,
    'movie' AS type,
    _score AS similarity_score
  FROM
    movie
  WHERE
    KNN_MATCH(
      vector_fingerprint,
      (SELECT vector_fingerprint FROM movie WHERE tmdb_id = 11),
      11
    )
    AND vector_fingerprint IS NOT NULL
    AND tmdb_id != 11
  LIMIT 10
),
similar_shows AS (
  SELECT
    tmdb_id AS _key,
    title,
    'show' AS type,
    _score AS similarity_score
  FROM
    show
  WHERE
    KNN_MATCH(
      vector_fingerprint,
      (SELECT vector_fingerprint FROM movie WHERE tmdb_id = 11),
      10
    )
    AND vector_fingerprint IS NOT NULL
  LIMIT 10
)
SELECT
  *
FROM
  (
    SELECT * FROM similar_movies
    UNION ALL
    SELECT * FROM similar_shows
  ) AS all_candidates
ORDER BY
  similarity_score DESC
LIMIT 10;
```

Simple Full-Text Search just by title, reranked by popularity:
```sql
WITH
  search_term AS (
    SELECT 'star wrs' AS query
  ),
  
  movie_hits AS (
    SELECT
      tmdb_id AS media_id,
      'movie' AS media_type,
      title,
      popularity,
      _score AS score
    FROM
      movie
    WHERE
      MATCH(title, (SELECT query FROM search_term))
    ORDER BY
      score DESC
    LIMIT 200
  ),

  show_hits AS (
    SELECT
      tmdb_id AS media_id,
      'show' AS media_type,
      title,
      popularity,
      _score AS score
    FROM
      show
    WHERE
      MATCH(title, (SELECT query FROM search_term))
    ORDER BY
      score DESC
    LIMIT 200
  )

SELECT * FROM movie_hits
UNION ALL
SELECT * FROM show_hits
ORDER BY
  popularity DESC
LIMIT 20;
```

Full-text by fuzzy matching for titles and alternative titles:
```sql
WITH
  search_term AS (
    SELECT 'str wrs' AS query
  ),

  -- Step 2: Find top movie matches with weight and type.
  movie_hits AS (
    SELECT
      tmdb_id AS media_id,
      'movie' AS media_type,
      title AS content,
      _score AS score,
      'title' AS search_result_type
    FROM
      movie
    WHERE
      MATCH(title 10, (SELECT query FROM search_term)) USING best_fields WITH (fuzziness=2, operator='and')
    ORDER BY
      score DESC
    LIMIT 20
  ),

  -- Step 3: Find top show matches with weight and type.
  show_hits AS (
    SELECT
      tmdb_id AS media_id,
      'show' AS media_type,
      title AS content,
      _score AS score,
      'title' AS search_result_type
    FROM
      show
    WHERE
      MATCH(title 10, (SELECT query FROM search_term)) USING best_fields WITH (fuzziness=2, operator='and')
    ORDER BY
      score DESC
    LIMIT 20
  ),

  -- Step 4: Find top alt title matches with weight and type.
  alt_title_hits AS (
    SELECT
      media_tmdb_id AS media_id,
      media_type,
      title AS content,
      _score AS score,
      'alternative_title' AS search_result_type
    FROM
      alternative_title
    WHERE
      MATCH(title 3, (SELECT query FROM search_term)) USING best_fields WITH (fuzziness=2, operator='and')
    ORDER BY
      score DESC
    LIMIT 20
  )

-- Step 5: Combine all candidates and display the top 20 overall.
SELECT
  media_id,
  media_type,
  content,
  score,
  search_result_type
FROM (
  SELECT * FROM movie_hits
  UNION ALL
  SELECT * FROM show_hits
  UNION ALL
  SELECT * FROM alt_title_hits
) AS all_hits
ORDER BY
  score DESC
LIMIT 20;
```

Full-text search with vote count and popularity reranking:
```sql
WITH
    search_term AS (
        SELECT 'matrix' AS query
    ),
    movie_hits AS (
        SELECT
            tmdb_id AS media_id, 'movie' AS media_type, title AS content,
            _score AS score, 'title' AS search_result_type
        FROM movie
        WHERE MATCH(title 10, (SELECT query FROM search_term)) USING best_fields WITH (fuzziness=1, operator='and')
ORDER BY score DESC
    LIMIT 20
    ),
    show_hits AS (
SELECT
    tmdb_id AS media_id, 'show' AS media_type, title AS content,
    _score AS score, 'title' AS search_result_type
FROM show
WHERE MATCH(title 10, (SELECT query FROM search_term)) USING best_fields WITH (fuzziness=1, operator='and')
ORDER BY score DESC
    LIMIT 20
    ),
    alt_title_hits AS (
SELECT
    media_tmdb_id AS media_id, media_type, title AS content,
    _score AS score, 'alternative_title' AS search_result_type
FROM alternative_title
WHERE MATCH(title 3, (SELECT query FROM search_term)) USING best_fields WITH (fuzziness=1, operator='and')
ORDER BY score DESC
    LIMIT 20
    ),
    all_hits_unranked AS (
SELECT * FROM movie_hits
UNION ALL
SELECT * FROM show_hits
UNION ALL
SELECT * FROM alt_title_hits
    )

SELECT
    u.media_id,
    u.media_type,
    u.content,
    (
        u.score * (
            POWER(LOG(COALESCE(m.popularity, s.popularity, 0) + 1), 2) +
            POWER(LOG(COALESCE(m.goodwatch_overall_score_voting_count, s.goodwatch_overall_score_voting_count, 0) + 1), 4)
            )
        ) AS final_score,
    u.score AS original_score,
    COALESCE(m.popularity, s.popularity, 0) AS popularity,
    COALESCE(m.goodwatch_overall_score_voting_count, s.goodwatch_overall_score_voting_count, 0) AS voting_count,
    u.search_result_type
FROM
    all_hits_unranked AS u
        LEFT JOIN movie AS m ON u.media_id = m.tmdb_id AND u.media_type = 'movie'
        LEFT JOIN show AS s ON u.media_id = s.tmdb_id AND u.media_type = 'show'
ORDER BY
    final_score DESC
    LIMIT 20;
```

Full-text search reranking and deduplication:
```sql
WITH
    search_term AS (
        SELECT 'matrix' AS query
    ),
    movie_hits AS (
        SELECT
            tmdb_id AS media_id,
            'movie' AS media_type,
            title AS content,
            _score AS score,
            'title' AS search_result_type
        FROM movie
        WHERE
            MATCH (title 1.5, (
                SELECT query
                FROM search_term
            ))
            USING best_fields WITH (fuzziness = 1, operator = 'and')
        ORDER BY score DESC
        LIMIT 20
    ),
    show_hits AS (
        SELECT
            tmdb_id AS media_id,
            'show' AS media_type,
            title AS content,
            _score AS score,
            'title' AS search_result_type
        FROM show
        WHERE
            MATCH (title 1.5, (
                SELECT query
                FROM search_term
            ))
            USING best_fields WITH (fuzziness = 1, operator = 'and')
        ORDER BY score DESC
        LIMIT 20
    ),
    alt_title_hits AS (
        SELECT
            media_tmdb_id AS media_id,
            media_type,
            title AS content,
            _score AS score,
            'alternative_title' AS search_result_type
        FROM alternative_title
        WHERE
            MATCH (title 0.5, (
                SELECT query
                FROM search_term
            ))
            USING best_fields WITH (fuzziness = 1, operator = 'and')
        ORDER BY score DESC
        LIMIT 20
    ),
    all_hits_unranked AS (
        SELECT * FROM movie_hits
        UNION ALL
        SELECT * FROM show_hits
        UNION ALL
        SELECT * FROM alt_title_hits
    ),
    deduplicated_hits AS (
        SELECT
            media_id,
            media_type,
            score AS max_score,
            match_count,
            content AS top_content,
            matched_on_contents,
            matched_on_types
        FROM (
            SELECT
                *,
                ROW_NUMBER() OVER (PARTITION BY media_id, media_type ORDER BY score DESC) AS rn,
                COUNT(*) OVER (PARTITION BY media_id, media_type) AS match_count,
                ARRAY_AGG(content) OVER (PARTITION BY media_id, media_type) AS matched_on_contents,
                ARRAY_AGG(search_result_type) OVER (PARTITION BY media_id, media_type) AS matched_on_types
            FROM all_hits_unranked
        ) AS ranked_hits
        WHERE
            rn = 1
    ),
    movie_meta AS (
        SELECT
            tmdb_id,
            popularity,
            goodwatch_overall_score_voting_count AS voting_count
        FROM movie
        WHERE
            tmdb_id = ANY (
                SELECT media_id
                FROM deduplicated_hits
                WHERE media_type = 'movie'
            )
    ),
    show_meta AS (
        SELECT
            tmdb_id,
            popularity,
            goodwatch_overall_score_voting_count AS voting_count
        FROM show
        WHERE
            tmdb_id = ANY (
                SELECT media_id
                FROM deduplicated_hits
                WHERE media_type = 'show'
            )
    )
SELECT
    d.media_id,
    d.media_type,
    d.top_content AS content,
    (
        d.max_score
        * POWER(LOG(COALESCE(meta.voting_count, 0) + 1), 5)
        * POWER(LOG(COALESCE(meta.popularity, 0) + 1), 2)
        * POWER(LOG(d.match_count + 1), 1)
    ) AS final_score,
    d.max_score AS original_score,
    meta.popularity,
    meta.voting_count,
    d.matched_on_contents,
    d.matched_on_types,
    d.match_count
FROM deduplicated_hits AS d
LEFT JOIN (
    SELECT * FROM movie_meta
    UNION ALL
    SELECT * FROM show_meta
) AS meta ON meta.tmdb_id = d.media_id
ORDER BY final_score DESC
LIMIT 20;
```
