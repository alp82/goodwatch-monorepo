# Example Queries

Fetch movies + scores with score filter

```aql
FOR movie IN movies
  FILTER LENGTH(
    FOR score IN 1..1 OUTBOUND movie has_score
      FILTER score.source == "aggregated" 
         AND score.score_type == "combined" 
         AND score.percent >= 80
      LIMIT 1
      RETURN true
  ) > 0
  SORT movie.popularity DESC
  LIMIT 10
  
  LET scores = (
    FOR score IN 1..1 OUTBOUND movie has_score // Traverse again from the selected movie
      // NO FILTER applied here - we want all scores for this movie
      RETURN score // Return the full score document
  )
  
  RETURN { 
    movie: movie, 
    scores: scores 
  } 
```