# Example Queries

Fetch movies + scores with score filter

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
