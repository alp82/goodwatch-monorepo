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

Find movies by DNA tag:
```aql
// Parameters: { "dnaCategory": "Mood", "dnaLabel": "Humorous", "limit": 20 }

// First, find the specified DNA node and its vector
LET dnaNode = FIRST(
  FOR d IN dna
    FILTER d.category == @dnaCategory AND d.label == @dnaLabel
    RETURN d
)

// Ensure we found a valid DNA node with a vector
FILTER dnaNode != null AND dnaNode.vector != null

// Find all movies that have DNA nodes of the same category as dnaNode
LET moviesWithDna = (
  FOR movie IN movies
    LET movieDnasOfSameCategory = (
      FOR v, e IN 1..1 OUTBOUND movie has_dna
        // Filter DNA nodes by the category of the initial dnaNode
        FILTER v.category == dnaNode.category // Or use @dnaCategory directly: FILTER v.category == @dnaCategory
        FILTER v.vector != null // Also ensure this DNA node has a vector
        RETURN v // Return the DNA node itself, or just its vector
    )
    
    // Proceed only if the movie has relevant DNA nodes
    FILTER LENGTH(movieDnasOfSameCategory) > 0
    
    // Calculate similarity for each relevant DNA node
    LET similarities = (
        FOR movieDnaNode IN movieDnasOfSameCategory
            LET similarity = LENGTH(movieDnaNode.vector) > 0 ?
                COSINE_SIMILARITY(dnaNode.vector, movieDnaNode.vector) : 0
            RETURN similarity
    )

    // Calculate average similarity and count of matches for this movie
    LET avgSimilarity = AVERAGE(similarities)
    LET dnaMatches = LENGTH(similarities) // This now correctly counts DNA nodes of the same category

    // Sort by similarity score (highest first)
    SORT avgSimilarity DESC
    LIMIT @limit
    RETURN {
      movie: movie, // movieDoc was movie, changed for clarity
      similarity: avgSimilarity,
      dnaMatchCount: dnaMatches
    }
)

// Return the results
RETURN moviesWithDna
```

Shows + people sorted by order:
```aql
```
