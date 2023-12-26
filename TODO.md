ValidationError: ValidationError (TmdbMovieDetails:656fbe42b583701d22b20712)
(results.release_dates.release_date.cannot parse date "2023-10-07T00:00:00.000Z": ['release_dates'])

# TODO's
```
priority scraping
important streaming links queue
important streaming link button
streaming missing: https://www.themoviedb.org/movie/872585-oppenheimer/watch
rotten ratings missing: http://localhost:3003/movie/1022964-candy-cane-lane
rotten score not up to date: http://localhost:3003/movie/961268-ballerina?tab=streaming
    wrong link: https://www.rottentomatoes.com/m/ballerina_2023
fury 2014, wrong rotten link: http://localhost:3003/movie/228150-fury

trending load more
discover load more

populate trending score

rotten wrong urls:
    https://www.rottentomatoes.com/m/cars_2006
 -> https://www.rottentomatoes.com/m/cars
 => try different variants and compare years!
 
 metacritic false positive:
    http://localhost:3003/tv/121-doctor-who
 -> should be empty
 => compare years!
 
identify title duplicates and run scraping again

page transition loader

filter inspiration:
    https://www.yidio.com/movies
    https://movielens.org/explore?people=brad%20pitt&minYear=2000&hasRated=no&sortBy=popularity
discover age ratings
discover actors
discover cast
discover scores
discover budget & revenue
disocver keywords and tropes
discoer fix empty streaming providers
localstorage: country and save streaming provider selection

postgres read replica

search page

random full screen: album cover (good roulette)

parallax scrolling landing page
best rated picks animation
stagger animation for rating progress bars
show picks on mobile too

description full text toggle
score explanations
streaming explanations
autocomplete dark style

explore button for media titles (prefilled discover, map feature)

show generic recommendations

android app

decide together: watch party / good swipe / swipe watch

report missing ratings
report missing streaming providers
report missing info
extra link for multiple in same year: https://www.rottentomatoes.com/m/nowhere_2023_2

data source: existing crawlers use existing url instead of guessing
data source: allmovie sub-genres, moods, themes, attributes, flags (https://www.allmovie.com/movie/fargo-vm422651)
data source: allmovie tones (https://www.allmovie.com/advanced-search)
data source: seasons ratings and details (flickvibe-webapp/app/routes/api/ratings/tv-seasons.tsx)
data source: imdb plotsummary + keywords
data source: letterboxd ratings
data source: tmdb people api
data source: moviespoiler + moviepooper

realtime updates
https://github.com/supabase/realtime

fix certification longer than 50 chars: 12 éven aluliak számára a megtekintése nagykorú felügyelete mellett ajánlott

issue: breaking bad streaming missing -> justwatch streaming data
issue: tmdb imagery redundant -> justwatch imagery
issue: videos not available or not a real trailer (ip man: kung fu master, plane 2023)

https://blog.logrocket.com/guide-adding-google-login-react-app/
https://github.com/MomenSherif/react-oauth
authentication and user profiles
connect accounts
notification when streaming is available
alerts for new search results

personalized recommendation engine:
* criticker
* movielens
```

```
https://leandronsp.com/a-powerful-full-text-search-in-postgresql-in-less-than-20-lines
https://rachbelaid.com/postgres-full-text-search-is-good-enough/
https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-HEADLINE

(similarity)
(unaccent(...))
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE INDEX movie_details_search_idx ON movie_details USING GIN (to_tsvector(movie_details.original_title || movie_details.tagline || movie_details.overview))

WITH search_query AS (
  SELECT 'carnage' AS query
)
SELECT
  media.*,
  (
	COALESCE(rank_title, 0) * 10 +
	COALESCE(rank_alternative_titles, 5) +
	COALESCE(rank_tagline, 0) * 4 +
	COALESCE(rank_synopsis, 0) * 2 +
	1 / (1 + exp(-10*(COALESCE(similarity, 0)-0.5))) * log10(popularity + 1)
  ) weighted_rank
FROM
  media
LEFT JOIN (
  SELECT
    media.id,
    ts_rank_cd(to_tsvector('english', unaccent(original_title)), plainto_tsquery('english', query)) as rank_title,
    ts_rank_cd(to_tsvector('english', unaccent(tagline)), plainto_tsquery('english', query)) as rank_tagline,
    ts_rank_cd(to_tsvector('english', unaccent(synopsis)), plainto_tsquery('english', query)) as rank_synopsis,
    ts_rank_cd(to_tsvector('english', unaccent(string_agg(DISTINCT alternative_titles.title::text, ' '))), plainto_tsquery('english', query)) as rank_alternative_titles,
    word_similarity(query, original_title) as similarity
  FROM
    media
    LEFT JOIN media_alternative_titles AS alternative_titles ON alternative_titles.media_id = media.id,
	search_query
  GROUP BY media.id, query
) as ranks ON media.id = ranks.id
WHERE
  ranks.rank_title > 0 OR
  ranks.rank_alternative_titles > 0 OR
  ranks.rank_tagline > 0 OR
  ranks.rank_synopsis > 0 OR
  similarity > 0
ORDER BY
  weighted_rank DESC NULLS LAST
LIMIT 20;
```