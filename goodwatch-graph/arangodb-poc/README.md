# Example Queries

Get most popular movies with DNA data:
```aql
FOR movie IN movies
    FILTER movie.essence_text != null
    SORT movie.popularity DESC
    LIMIT 10
    RETURN movie
```

Similar to star wars by fingerprint:
```aql
LET movie_key = "11"

LET target_movie_vector = (
    FOR movie IN movies
        FILTER movie._key == movie_key
        LIMIT 1
        RETURN movie.vector_fingerprint
)[0]

FOR movie IN movies
    FILTER movie.essence_text != null
    FILTER movie._key != movie_key
    LET similarity = COSINE_SIMILARITY(target_movie_vector, movie.vector_fingerprint)
    SORT similarity DESC
    LIMIT 10
    RETURN {
        _key: movie._key,
        title: movie.title,
        similarity_score: similarity
    }
```

Similar to star wars by fingerprint (DEBUG version):
```aql
LET movie_key = "11"

LET target_movie = (
    FOR movie IN movies
        FILTER movie._key == movie_key
        LIMIT 1
        RETURN movie
)[0]

FILTER target_movie != null AND target_movie.fingerprint_scores != null
LET target_movie_vector = target_movie.vector_fingerprint
LET target_movie_scores = target_movie.fingerprint_scores

FOR movie IN movies
    FILTER movie.essence_text != null
    FILTER movie._key != movie_key
    FILTER movie.fingerprint_scores != null

    LET similarity = COSINE_SIMILARITY(target_movie_vector, movie.vector_fingerprint)
    LET current_movie_scores = movie.fingerprint_scores

    LET score_differences = (
        FOR score_key IN ATTRIBUTES(target_movie_scores)
            LET target_value = target_movie_scores[score_key]
            LET current_value = current_movie_scores[score_key]
            // Add a check here as well in case some scores are missing in individual documents
            FILTER target_value != null AND current_value != null AND target_value != current_value
            LET difference = ABS(target_value - current_value)
            SORT difference DESC
            LIMIT 3
            RETURN {
                score_name: score_key,
                target_value: target_value,
                current_value: current_value,
                difference: difference
            }
    )

    SORT similarity DESC
    LIMIT 20
    RETURN {
        _key: movie._key,
        title: movie.title,
        similarity_score: similarity,
        fingerprint_scores_differences: score_differences
    }
```

Full-Text Search:
```aql
// Define the raw search string
LET rawSearchString = "leonardo dicaprio"
LET searchTokens = TOKENS(rawSearchString, "text_en")
LET tokenCount = LENGTH(searchTokens)

// --- 1. ENHANCED CONTROL PANEL ---
LET controlPanel = {
    candidatePoolSize: 200,
    fixedMaxBm25: 25000,        
    maxLogPopularity: 20,       
    minScoreThreshold: 50,      // Lowered threshold for better fuzzy matching
    maxEditDistance: 3,         // Increased edit distance for better fuzzy matching
    enableFuzzyFallback: true,
    minPopularityForBoost: 1,   
    minPopularityToShow: 0      // Allow all popularity levels for fuzzy matches
}

LET boostFactors = {
    exactMatch: 500,
    movieShowTitle: 100, 
    alternativeTitle: 50, 
    personName: 30, 
    essenceTag: 20,
    seriesName: 10, 
    essenceText: 15, 
    seasonName: 5, 
    synopsisOverview: 1,
    tagline: 2,
    prefixMatch: 25
}

LET rankingWeights = {
    relevance: 2,             // Further reduced relevance weight
    popularity: 3.0,          // Massively increased popularity weight
    castOrder: 0.8,
    recency: 0.3
}

// --- 2. OPTIMIZED SEARCH QUERIES WITH PROPER MULTI-TOKEN MATCHING ---

LET titleHits = (
    FOR doc IN global_search
        SEARCH ANALYZER(
            // Multi-token matching with enhanced fuzzy support
            tokenCount == 1 ? 
                // Single token - try exact, prefix, then fuzzy
                (BOOST(PHRASE(doc.title, searchTokens[0], "text_en"), boostFactors.movieShowTitle * 5) OR
                 BOOST(STARTS_WITH(doc.title, searchTokens[0]), boostFactors.movieShowTitle * 2.5) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.title, searchTokens[0], controlPanel.maxEditDistance, false), boostFactors.movieShowTitle) OR
                 BOOST(PHRASE(doc.original_title, searchTokens[0], "text_en"), boostFactors.movieShowTitle * 5) OR
                 BOOST(STARTS_WITH(doc.original_title, searchTokens[0]), boostFactors.movieShowTitle * 2.5) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.original_title, searchTokens[0], controlPanel.maxEditDistance, false), boostFactors.movieShowTitle) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.essence_text, searchTokens[0], 1, false), boostFactors.essenceText) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.synopsis, searchTokens[0], 1, false), boostFactors.synopsisOverview) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.tagline, searchTokens[0], 1, false), boostFactors.tagline)) :
            // Multi-token: Try both strict AND flexible matching
            (
                // Strict: BOTH tokens must match (for high precision)
                (BOOST(
                    (LEVENSHTEIN_MATCH(doc.title, searchTokens[0], controlPanel.maxEditDistance, false) AND 
                     LEVENSHTEIN_MATCH(doc.title, searchTokens[1], controlPanel.maxEditDistance, false))
                , boostFactors.movieShowTitle * 2) OR
                BOOST(
                    (LEVENSHTEIN_MATCH(doc.original_title, searchTokens[0], controlPanel.maxEditDistance, false) AND 
                     LEVENSHTEIN_MATCH(doc.original_title, searchTokens[1], controlPanel.maxEditDistance, false))
                , boostFactors.movieShowTitle * 2)) OR
                
                // Flexible: At least one token matches well (for fuzzy cases like "star wrs")
                (BOOST(
                    (LEVENSHTEIN_MATCH(doc.title, searchTokens[0], 1, false) OR 
                     LEVENSHTEIN_MATCH(doc.title, searchTokens[1], controlPanel.maxEditDistance, false))
                , boostFactors.movieShowTitle) OR
                BOOST(
                    (LEVENSHTEIN_MATCH(doc.original_title, searchTokens[0], 1, false) OR 
                     LEVENSHTEIN_MATCH(doc.original_title, searchTokens[1], controlPanel.maxEditDistance, false))
                , boostFactors.movieShowTitle)) OR
                
                // Content fields - more lenient
                BOOST(
                    (LEVENSHTEIN_MATCH(doc.essence_text, searchTokens[0], 1, false) OR 
                     LEVENSHTEIN_MATCH(doc.essence_text, searchTokens[1], 2, false))
                , boostFactors.essenceText) OR
                BOOST(
                    (LEVENSHTEIN_MATCH(doc.synopsis, searchTokens[0], 1, false) OR 
                     LEVENSHTEIN_MATCH(doc.synopsis, searchTokens[1], 2, false))
                , boostFactors.synopsisOverview)
            )
        , "text_en")
        FILTER PARSE_IDENTIFIER(doc).collection IN ["movies", "shows"]
        LET score = BM25(doc)
        FILTER score > controlPanel.minScoreThreshold
        SORT score DESC
        LIMIT controlPanel.candidatePoolSize
        RETURN { score: score, sourceDoc: doc, type: "title" }
)

LET personHits = (
    FOR doc IN global_search
        SEARCH ANALYZER(
            tokenCount == 1 ? 
                (BOOST(PHRASE(doc.name, searchTokens[0], "text_en"), boostFactors.personName * 5) OR
                 BOOST(STARTS_WITH(doc.name, searchTokens[0]), boostFactors.personName * 2.5) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.name, searchTokens[0], controlPanel.maxEditDistance, false), boostFactors.personName)) :
                // Multi-token person names - more flexible matching
                (BOOST(
                    (LEVENSHTEIN_MATCH(doc.name, searchTokens[0], controlPanel.maxEditDistance, false) AND 
                     LEVENSHTEIN_MATCH(doc.name, searchTokens[1], controlPanel.maxEditDistance, false))
                , boostFactors.personName * 2) OR
                BOOST(
                    (LEVENSHTEIN_MATCH(doc.name, searchTokens[0], 1, false) OR 
                     LEVENSHTEIN_MATCH(doc.name, searchTokens[1], controlPanel.maxEditDistance, false))
                , boostFactors.personName))
        , "text_en")
        FILTER PARSE_IDENTIFIER(doc).collection == "persons"
        LET score = BM25(doc)
        FILTER score > controlPanel.minScoreThreshold
        SORT score DESC
        LIMIT controlPanel.candidatePoolSize
        RETURN { score: score, sourceDoc: doc, type: "person" }
)

LET tagHits = (
    FOR doc IN global_search
        SEARCH ANALYZER(
            tokenCount == 1 ? 
                (BOOST(PHRASE(doc.name, searchTokens[0], "text_en"), boostFactors.essenceTag * 5) OR
                 BOOST(STARTS_WITH(doc.name, searchTokens[0]), boostFactors.essenceTag * 2.5) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.name, searchTokens[0], 1, false), boostFactors.essenceTag)) :
            BOOST(
                (LEVENSHTEIN_MATCH(doc.name, searchTokens[0], 1, false) AND 
                 LEVENSHTEIN_MATCH(doc.name, searchTokens[1], 1, false))
            , boostFactors.essenceTag)
        , "text_en")
        FILTER PARSE_IDENTIFIER(doc).collection == "essence_tags"
        LET score = BM25(doc)
        FILTER score > controlPanel.minScoreThreshold
        SORT score DESC
        LIMIT controlPanel.candidatePoolSize / 4
        RETURN { score: score, sourceDoc: doc, type: "tag" }
)

LET seriesHits = (
    FOR doc IN global_search
        SEARCH ANALYZER(
            tokenCount == 1 ? 
                (BOOST(PHRASE(doc.name, searchTokens[0], "text_en"), boostFactors.seriesName * 5) OR
                 BOOST(STARTS_WITH(doc.name, searchTokens[0]), boostFactors.seriesName * 2.5) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.name, searchTokens[0], controlPanel.maxEditDistance, false), boostFactors.seriesName)) :
            BOOST(
                (LEVENSHTEIN_MATCH(doc.name, searchTokens[0], controlPanel.maxEditDistance, false) AND 
                 LEVENSHTEIN_MATCH(doc.name, searchTokens[1], controlPanel.maxEditDistance, false))
            , boostFactors.seriesName)
        , "text_en")
        FILTER PARSE_IDENTIFIER(doc).collection == "movie_series"
        LET score = BM25(doc)
        FILTER score > controlPanel.minScoreThreshold
        SORT score DESC
        LIMIT controlPanel.candidatePoolSize / 4
        RETURN { score: score, sourceDoc: doc, type: "series" }
)

LET seasonHits = (
    FOR doc IN global_search
        SEARCH ANALYZER(
            tokenCount == 1 ? 
                (BOOST(PHRASE(doc.name, searchTokens[0], "text_en"), boostFactors.seasonName * 5) OR
                 BOOST(STARTS_WITH(doc.name, searchTokens[0]), boostFactors.seasonName * 2.5) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.name, searchTokens[0], controlPanel.maxEditDistance, false), boostFactors.seasonName) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.overview, searchTokens[0], 1, false), boostFactors.synopsisOverview)) :
            (BOOST(
                (LEVENSHTEIN_MATCH(doc.name, searchTokens[0], controlPanel.maxEditDistance, false) AND 
                 LEVENSHTEIN_MATCH(doc.name, searchTokens[1], controlPanel.maxEditDistance, false))
            , boostFactors.seasonName) OR
            BOOST(
                (LEVENSHTEIN_MATCH(doc.overview, searchTokens[0], 1, false) AND 
                 LEVENSHTEIN_MATCH(doc.overview, searchTokens[1], 1, false))
            , boostFactors.synopsisOverview))
        , "text_en")
        FILTER PARSE_IDENTIFIER(doc).collection == "seasons"
        LET score = BM25(doc)
        FILTER score > controlPanel.minScoreThreshold
        SORT score DESC
        LIMIT controlPanel.candidatePoolSize / 4
        RETURN { score: score, sourceDoc: doc, type: "season" }
)

LET altTitleHits = (
    FOR doc IN global_search
        SEARCH ANALYZER(
            tokenCount == 1 ? 
                (BOOST(PHRASE(doc.title, searchTokens[0], "text_en"), boostFactors.alternativeTitle * 5) OR
                 BOOST(STARTS_WITH(doc.title, searchTokens[0]), boostFactors.alternativeTitle * 2.5) OR
                 BOOST(LEVENSHTEIN_MATCH(doc.title, searchTokens[0], controlPanel.maxEditDistance, false), boostFactors.alternativeTitle)) :
            BOOST(
                (LEVENSHTEIN_MATCH(doc.title, searchTokens[0], controlPanel.maxEditDistance, false) AND 
                 LEVENSHTEIN_MATCH(doc.title, searchTokens[1], controlPanel.maxEditDistance, false))
            , boostFactors.alternativeTitle)
        , "text_en")
        FILTER PARSE_IDENTIFIER(doc).collection == "alternative_titles"
        LET score = BM25(doc)
        FILTER score > controlPanel.minScoreThreshold
        SORT score DESC
        LIMIT controlPanel.candidatePoolSize / 4
        RETURN { score: score, sourceDoc: doc, type: "alt_title" }
)

// --- 3. COMBINATION AND TRAVERSAL ---
LET allSourceHits = UNION_DISTINCT(titleHits, personHits, tagHits, seriesHits, seasonHits, altTitleHits)

LET candidateHits = (
    FOR h IN allSourceHits 
        SORT h.score DESC 
        LIMIT controlPanel.candidatePoolSize 
        RETURN h
)

// --- 4. ENHANCED TRAVERSAL AND RANKING ---
FOR hit IN candidateHits
    LET score = hit.score
    LET doc = hit.sourceDoc
    LET coll = PARSE_IDENTIFIER(doc).collection
    LET hitType = hit.type
    
    LET mediaDocs = (
        coll == 'persons' ? (
            FOR media, edge IN 1..1 OUTBOUND doc person_appeared_in 
                FILTER PARSE_IDENTIFIER(media).collection IN ['movies', 'shows']
                RETURN {doc: media, edge: edge, traversalType: "cast"}
        ) :
        coll == 'essence_tags' ? (
            FOR media, edge IN 1..1 INBOUND doc essence_tag_for 
                FILTER PARSE_IDENTIFIER(media).collection IN ['movies', 'shows']
                RETURN {doc: media, edge: edge, traversalType: "tag"}
        ) :
        coll == 'alternative_titles' ? (
            FOR media, edge IN 1..1 INBOUND doc alternative_title_for 
                FILTER PARSE_IDENTIFIER(media).collection IN ['movies', 'shows']
                RETURN {doc: media, edge: edge, traversalType: "alt_title"}
        ) :
        coll == 'seasons' ? (
            FOR media, edge IN 1..1 OUTBOUND doc show_has_season 
                FILTER PARSE_IDENTIFIER(media).collection IN ['movies', 'shows']
                RETURN {doc: media, edge: edge, traversalType: "season"}
        ) :
        coll == 'movie_series' ? (
            FOR media, edge IN 1..1 OUTBOUND doc movie_belongs_to_series 
                FILTER PARSE_IDENTIFIER(media).collection IN ['movies', 'shows']
                RETURN {doc: media, edge: edge, traversalType: "series"}
        ) :
        [{doc: doc, edge: null, traversalType: "direct"}]
    )
    
    FOR media_obj IN mediaDocs
        FILTER media_obj.doc != null
        // More lenient popularity filter for fuzzy matches
        FILTER media_obj.doc.popularity == null OR media_obj.doc.popularity >= controlPanel.minPopularityToShow OR score > 500
        COLLECT finalMedia = media_obj.doc INTO G = { 
            score: score, 
            sourceDoc: doc, 
            edge: media_obj.edge,
            hitType: hitType,
            traversalType: media_obj.traversalType
        }
        
        // Aggregate scores from multiple paths
        LET totalScore = SUM(FOR g IN G RETURN g.score)
        LET bestHit = (FOR g IN G SORT g.score DESC LIMIT 1 RETURN g)[0]
        LET pathCount = LENGTH(G)
        
        // Fixed normalization with proper handling of edge cases
        LET bm25Score = totalScore
        LET normBm25 = MIN([bm25Score / controlPanel.fixedMaxBm25, 1.0])
        
        // Fixed popularity normalization - handle null/low values properly
        LET popularity = finalMedia.popularity != null ? finalMedia.popularity : 0
        LET normPop = popularity >= controlPanel.minPopularityForBoost ? 
            MIN([LOG(popularity) / controlPanel.maxLogPopularity, 1.0]) : 
            (popularity / controlPanel.minPopularityForBoost * 0.1)  // Small boost for low popularity
            
        // Enhanced cast order scoring
        LET normCastOrder = bestHit.edge && bestHit.edge.order != null ? 
            (1 / (bestHit.edge.order + 1)) : 
            (bestHit.traversalType == "direct" ? 1.0 : 0.5)
            
        // Recency boost (if release_date exists)
        LET releaseYear = finalMedia.release_date ? DATE_YEAR(finalMedia.release_date) : 1900
        LET currentYear = DATE_YEAR(DATE_NOW())
        LET normRecency = releaseYear > 1900 ? 
            MAX([0, 1 - ((currentYear - releaseYear) / 50)]) : 0
            
        // Path diversity bonus
        LET diversityBonus = pathCount > 1 ? LOG(pathCount) * 0.05 : 0  // Reduced impact
        
        // Popularity multiplier for very popular content - much more aggressive
        LET popularityMultiplier = popularity > 500 ? 5.0 : 
                                  popularity > 100 ? 3.0 : 
                                  popularity > 50 ? 2.0 : 
                                  popularity > 20 ? 1.5 : 
                                  popularity > 10 ? 1.2 : 1.0
        
        // Additional boost for highly relevant + popular content
        LET relevancePopularityBonus = (normBm25 > 0.5 AND popularity > 50) ? 2.0 : 
                                      (normBm25 > 0.3 AND popularity > 20) ? 1.0 : 0
        
        // Rebalanced final ranking with popularity focus
        LET baseScore = (normBm25 * rankingWeights.relevance) + 
                       (normCastOrder * rankingWeights.castOrder) +
                       (normRecency * rankingWeights.recency) +
                       diversityBonus
                       
        LET finalRank = (baseScore + (normPop * rankingWeights.popularity) + relevancePopularityBonus) * popularityMultiplier
        
        FILTER finalRank > 0.5 OR (popularity >= 20 AND finalRank > 0.2)  // More lenient for popular content and fuzzy matches
        SORT finalRank DESC
        LIMIT 10
        
        RETURN {
            title: finalMedia.title,
            original_title: finalMedia.original_title,
            popularity: finalMedia.popularity,
            release_date: finalMedia.release_date,
            finalRank: finalRank,
            pathCount: pathCount,
            
            rankingDetails: { 
                bm25: bm25Score, 
                normalized_bm25: normBm25, 
                normalized_popularity: normPop,
                raw_popularity: popularity,
                normalized_castOrder: normCastOrder,
                normalized_recency: normRecency,
                diversity_bonus: diversityBonus,
                popularity_multiplier: popularityMultiplier,
                relevance_popularity_bonus: relevancePopularityBonus,
                base_score: baseScore
            },
            
            insights: { 
                sourceDocument_id: bestHit.sourceDoc._id,
                sourceDocument_type: bestHit.hitType,
                traversalEdge_id: bestHit.edge ? bestHit.edge._id : null,
                traversal_type: bestHit.traversalType,
                match_paths: LENGTH(G),
                search_tokens: searchTokens,
                token_count: tokenCount
            }
        }
```







## -------------- OLD --------------


Search for movies in all languages:
```aql
LET search_input = LOWER("%loade%")

LET all_search_matches = (
    FOR result IN global_search
        SEARCH ANALYZER(result.title LIKE search_input, "text_en") 
        
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
