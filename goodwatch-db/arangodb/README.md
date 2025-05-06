# Example Queries

Fetch movies + scores with score filter:
```aql
FOR movie IN movies
  LET filter_score_array = (
    FOR score IN 1..1 OUTBOUND movie has_score 
      FILTER
        score.source == "aggregated"
        AND score.score_type == "combined"
        AND score.percent >= 65
      LIMIT 1 
      RETURN score
  )
  
  FILTER LENGTH(filter_score_array) > 0 
  
  LET filter_score = filter_score_array[0] 
  SORT filter_score.percent DESC 
  LIMIT 10
  
  LET all_scores = (
    FOR score IN 1..1 OUTBOUND movie has_score
      RETURN { score: score.source, type: score.score_type, percent: score.percent } 
  )
  
  RETURN { 
    movie_id: movie._id,
    movie_title: movie.title,
    movie_release: movie.release_year,
    sort_score: filter_score.percent,
    scores: all_scores 
  }
```

Fetch movies + streaming availability with country filter:
```aql
LET current_timestamp = DATE_NOW()

FOR movie IN movies
  LET availability_in_country = (
    FOR availability IN 1..1 OUTBOUND movie has_streaming_availability
      FILTER availability.country == "DE"
         AND (availability.start_date == null OR DATE_TIMESTAMP(availability.start_date) <= current_timestamp) 
         AND (availability.end_date == null OR DATE_TIMESTAMP(availability.end_date) >= current_timestamp)
      RETURN availability
  )
  
  FILTER LENGTH(availability_in_country) > 0 

  SORT movie.popularity DESC
  LIMIT 100 
  
  RETURN { 
    movie_id: movie._id, 
    title: movie.title, 
    availability_in_country: availability_in_country 
  }
```

Simple DNA similarity search:
```aql
LET target_title_id = "movies/a_minecraft_movie_950387"

LET target_dna_vector = FIRST(
  FOR dna_doc IN 1..1 OUTBOUND target_title_id has_dna LIMIT 1 RETURN dna_doc.vector 
)

FILTER target_dna_vector != null AND IS_ARRAY(target_dna_vector)

FOR other_title IN movies 
  FILTER other_title._id != target_title_id 

  LET other_dna_vector = FIRST(
    FOR dna_doc IN 1..1 OUTBOUND other_title._id has_dna LIMIT 1 RETURN dna_doc.vector
  )

  // IMPORTANT: Only proceed for candidates that also have a valid vector
  FILTER other_dna_vector != null AND IS_ARRAY(other_dna_vector)

  LET similarity_score = COSINE_SIMILARITY(target_dna_vector, other_dna_vector)

  LIMIT 5 // Look at the first 5 pairs that have valid vectors

  RETURN {
    candidate_title_id: other_title._id,
    similarity: similarity_score,
  }
```

Shows + people sorted by order:
```aql
```
