# Example Queries

```aql
FOR movie IN movies
    FILTER (
        FOR score IN movie.scores
            FILTER score.source == "aggregated" AND score.score_type == "combined" AND score.percent >= 80
            RETURN true
    )[0] == true
    SORT movie.popularity DESC
    LIMIT 10
    RETURN movie
```