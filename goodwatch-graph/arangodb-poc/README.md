# Example Queries

Case insensitive full text analyzer in arangosh:
```javascript
db._useDatabase("goodwatch2");
var analyzers = require("@arangodb/analyzers");
var analyzerName = "lowercase_norm";
analyzers.remove(analyzerName, true);
var definition = {
  "locale": "en.utf-8",
  "case": "lower",
  "accent": false
}
var features = []
analyzers.save(analyzerName, "norm", definition, features);
```

View for full text search:
```json
{
  "writebufferSizeMax": 33554432,
  "id": "50475738",
  "storedValues": [],
  "name": "movie_search",
  "type": "arangosearch",
  "consolidationPolicy": {
    "type": "tier",
    "segmentsBytesFloor": 2097152,
    "segmentsBytesMax": 5368709120,
    "segmentsMax": 10,
    "segmentsMin": 1,
    "minScore": 0
  },
  "writebufferActive": 0,
  "links": {
    "movies": {
      "fields": {
        "title": {
          "analyzers": ["lowercase_norm"]
        }
      },
      "includeAllFields": false,
      "storeValues": "none",
      "trackListPositions": false
    },
    "alternative_titles": {
      "fields": {
        "title": {
          "analyzers": ["lowercase_norm"]
        }
      },
      "includeAllFields": false,
      "storeValues": "none",
      "trackListPositions": false
    }
  },
  "commitIntervalMsec": 1000,
  "consolidationIntervalMsec": 1000,
  "globallyUniqueId": "h1EF97D6549F7/50475738",
  "cleanupIntervalStep": 2,
  "primarySort": [],
  "primarySortCompression": "lz4",
  "writebufferIdle": 64
}
```

Search for movies in all languages:
```aql
LET search_input = LOWER("%loade%")

LET all_search_matches = (
    FOR result IN movie_search
        SEARCH ANALYZER(result.title LIKE search_input, "lowercase_norm") 
        
        LET is_direct_movie_match = IS_SAME_COLLECTION("movies", result._id)
        LET movie_document = (
            is_direct_movie_match
                ? DOCUMENT(result._id) 
                : DOCUMENT(CONCAT("movies/", result.parent_key)) 
        )
        
        FILTER movie_document
        
        RETURN {
            movie: movie_document,
            is_direct_movie_match: is_direct_movie_match,
            original_match_result: result
        }
)

LET distinct_movies_with_details = (
    FOR search_match IN all_search_matches
        COLLECT movie_key = search_match.movie._key
        AGGREGATE
            matches_per_movie = PUSH(search_match)

        LET movie = matches_per_movie[0].movie

        LET direct_match_found_subquery = (
            FOR match IN matches_per_movie
                FILTER match.is_direct_movie_match == true 
                LIMIT 1 
                RETURN 1
        )
        LET has_direct_match_for_group = LENGTH(direct_match_found_subquery) > 0
        
        LET alternative_titles_list = (NOT has_direct_match_for_group 
            ? (
                FOR match IN matches_per_movie
                    RETURN { 
                        title: match.original_match_result.title,       
                        country: match.original_match_result.iso_3166_1 
                    }
              )
            : []
        )

        RETURN {
            id: movie._id,
            title: movie.title,
            release_year: movie.release_year,
            popularity: movie.popularity, 
            alternative_titles: alternative_titles_list,
            was_direct_match: has_direct_match_for_group
        }
)

FOR movie IN distinct_movies_with_details
    SORT 
        movie.was_direct_match DESC,
        movie.popularity DESC
    LIMIT 10
    RETURN MERGE(UNSET(movie, "was_direct_match"), { 
        alternative_titles: LENGTH(movie.alternative_titles) > 0 ? movie.alternative_titles : null 
    })
```


Fetch movies + scores with score filter:
```aql
LET qualifying_filter_scores_with_movie = (
    FOR score IN scores
        FILTER score.source == "aggregated"
            AND score.score_type == "combined"
            AND score.percent >= 80
            AND score.rating_count >= 500
        
        FOR movie, edge IN 1..1 INBOUND score._id has_score
            SORT score.percent DESC
            LIMIT 10 
            RETURN {
                movie_doc: movie,
                filter_score_doc: score
            }
)

FOR movie_score_pair IN qualifying_filter_scores_with_movie
    LET movie = movie_score_pair.movie_doc
    LET filter_score = movie_score_pair.filter_score_doc

    LET all_scores_for_this_movie = (
        FOR score IN 1..1 OUTBOUND movie._id has_score
            RETURN {
                source: score.source,
                type: score.score_type,
                percent: score.percent,
                rating_count: score.rating_count,
                url: score.url
            }
    )
    
    RETURN {
        movie_id: movie._id,
        movie_title: movie.title,
        movie_release: movie.release_year,
        sort_score: filter_score.percent,
        scores: all_scores_for_this_movie
    }
```

Fetch movies + streaming availability with country filter:
```aql
LET target_country = "DE"
LET target_provider = "apple_tv_2"
LET current_timestamp = DATE_NOW() / 1000

LET distinct_available_movies_with_all_availabilities = (
    FOR availability IN streaming_availability
        FILTER availability.country == target_country
            AND availability.provider_id == target_provider
            AND (availability.startTimestamp == null OR availability.startTimestamp <= current_timestamp) 
            AND (availability.endTimestamp == null OR availability.endTimestamp >= current_timestamp)

        FOR movie_doc_candidate IN 1..1 INBOUND availability._id has_streaming_availability
            
            COLLECT movie_key = movie_doc_candidate._key 
            AGGREGATE 
                all_matching_pairs_for_movie = PUSH({ 
                    movie_doc: movie_doc_candidate, 
                    qual_avail_node: availability 
                })
            
            LET representative_movie_doc = all_matching_pairs_for_movie[0].movie_doc
            
            LET all_qualifying_avail_nodes_for_this_movie = (
                FOR pair IN all_matching_pairs_for_movie
                    RETURN pair.qual_avail_node
            )
            
            RETURN { 
                movie_doc: representative_movie_doc, 
                all_availabilities: all_qualifying_avail_nodes_for_this_movie 
            }
)

LET top_10_popular_available_movies = (
    FOR entry IN distinct_available_movies_with_all_availabilities
        SORT entry.movie_doc.popularity DESC
        LIMIT 10
        RETURN entry
)

FOR final_entry IN top_10_popular_available_movies
    RETURN { 
        movie_id: final_entry.movie_doc._id, 
        title: final_entry.movie_doc.title, 
        availability_in_country: final_entry.all_availabilities 
    }
```

Simple DNA similarity search (TODO new DNA - this is pretty slow):
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
  FILTER other_dna_vector != null AND IS_ARRAY(other_dna_vector)

  LET similarity_score = COSINE_SIMILARITY(target_dna_vector, other_dna_vector)
  SORT similarity_score DESC
  LIMIT 10

  RETURN {
    candidate_title_id: other_title._id,
    similarity: similarity_score,
  }
```

Find movies by DNA tag:
```aql
// Parameters: { "dnaCategory": "Mood", "dnaLabel": "Humorous" }

LET dnaNode = FIRST(
  FOR d IN dna
    FILTER d.category == @dnaCategory AND d.label == @dnaLabel
    RETURN d
)

FILTER dnaNode != null AND dnaNode.vector != null

FOR movie IN movies
  LET movieDnasOfSameCategory = (
    FOR v, e IN 1..1 OUTBOUND movie has_dna
      FILTER v.category == dnaNode.category
      FILTER v.vector != null
      RETURN v
  )
  
  FILTER LENGTH(movieDnasOfSameCategory) > 0
  
  LET similarities = (
      FOR movieDnaNode IN movieDnasOfSameCategory
          LET similarity = LENGTH(movieDnaNode.vector) > 0 ?
              COSINE_SIMILARITY(dnaNode.vector, movieDnaNode.vector) : 0
          RETURN similarity
  )

  LET avgSimilarity = AVERAGE(similarities)
  LET dnaMatches = LENGTH(similarities)

  SORT avgSimilarity DESC
  LIMIT 10
  RETURN {
    title: movie.title,
    release: movie.release_year,
    similarity: avgSimilarity,
    dnaMatchCount: dnaMatches
  }
```

Shows + people sorted by order:
```aql
```
