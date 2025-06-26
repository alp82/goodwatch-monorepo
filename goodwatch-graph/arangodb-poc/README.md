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

Similar to star wars by fingerprint (movies and shows):
```aql
LET movie_key = "11"

LET target_vector = (
    FOR movie IN movies
        FILTER movie._key == movie_key
        LIMIT 1
        RETURN movie.vector_fingerprint
)[0]

LET similar_movies = (
    FOR movie IN movies
        FILTER movie.vector_fingerprint != null
        FILTER movie._key != movie_key
        LET similarity = COSINE_SIMILARITY(target_vector, movie.vector_fingerprint)
        RETURN {
            _key: movie._key,
            title: movie.title,
            type: "movie",
            similarity_score: similarity
        }
)

LET similar_shows = (
    FOR show IN shows
        FILTER show.vector_fingerprint != null
        LET similarity = COSINE_SIMILARITY(target_vector, show.vector_fingerprint)
        RETURN {
            _key: show._key,
            title: show.title,
            type: "show",
            similarity_score: similarity
        }
)

FOR item IN UNION(similar_movies, similar_shows)
    SORT item.similarity_score DESC
    LIMIT 10
    RETURN item

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

Fetch movies + shows with streaming availability filtered by country and service:
```aql
WITH movies, shows, streaming_availabilities

LET target_country_code = "DE"
LET target_service_id = 8 // Netflix
LET target_availability = CONCAT_SEPARATOR("_", target_country_code, target_service_id)

LET top_10_docs = (
    FOR doc IN UNION(
        (FOR m IN movies
            FILTER target_availability IN m.streaming_availabilities
            RETURN { _id: m._id, popularity: m.popularity, title: m.title }),
        (FOR s IN shows
            FILTER target_availability IN s.streaming_availabilities
            RETURN { _id: s._id, popularity: s.popularity, title: s.title })
    )
    SORT doc.popularity DESC
    LIMIT 10
    RETURN doc
)

FOR doc IN top_10_docs
    LET availability_in_country = (
        FOR availability IN 1..1 OUTBOUND doc._id streaming_availability_for
            FILTER availability.country_code == target_country_code
               AND availability.streaming_service_id == target_service_id
            RETURN availability
    )
    RETURN {
        id: doc._id,
        title: doc.title,
        popularity: doc.popularity,
        availability_in_country: availability_in_country
    }
```
