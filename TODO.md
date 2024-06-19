# TODO's
```
check all sql injection targets

streaming providers from tmdb api with all country ranks
    remove old scripts and schedules

init scripts only insert new and ignore existing ids
copy/combine scripts only copy diffs to postgres

genome display
    plot spoilers: https://github.com/molefrog/spoiled
    https://www.iconfinder.com/search?q=genome&price=free

hugchat invalid login
    http://coinmatica.net:9000/run/019025ae-07af-79a2-e9df-00f859932da9?workspace=flickvibe

tvtropes number to string conversion
    https://chatgpt.com/g/g-FZtypBX5c-goodwatch-ai/c/9871cbb0-ca78-46a6-8cd1-732519e36f6e

copy movie/tv genome filter:
    None, N/A
    capitalize
    
posthog custom events
    https://posthog.com/tutorials/remix-analytics#capturing-custom-events

error handling: http://localhost:3003/tv/252146-who-killed-him
    fallback?
    priority?
    https://www.themoviedb.org/tv/252146-quien-lo-mato

onboarding:
* select streaming services
* ratings + favs
* watched + wishlist

react-query
offline support

redistribute weight for gw score

more lightweight user data

stats
# of movies
# of tv shows
# of ratings per site
# of streaming links
# of tropes
avg rating per provider
oldest fetch date

all titles from a-z (search page?)
    difference between search, explore, discover, watch next, etc.?

similarity vectors flow

guides
    by genre
    by mood
    etc.

show title in current language

details: images tab

wishlist with search
watched page (with search)
favorites page (with search)

tv seasons:
get episodes
get ratings
show in details
when last season/episode was released

combined collection score

user favs: actors, directors, writers

show similar/related movies

poster: inline scoring / watched / wish 

streaming: show flatrate countries in ratingblock and streaming tab

tv: watched vs currently watching (finished show)

ratings: show last updated time

date of first streaming link / new to stream

trending load more
discover load more

replace url for details when country changes
better discover url handling with new hook

show movies and shows on map (production country + places in film)
    where to show space and fantasy places

populate trending score 1-500
save trending scores per day
trending yesterday
trending difference

details:
box office (e.g. Google)
crew links to discovery
awards (grab from API)

discover sidebar redesign
filter inspiration:
    https://www.yidio.com/movies
    https://movielens.org/explore?people=brad%20pitt&minYear=2000&hasRated=no&sortBy=popularity
discover: unselect streaming
discover: unselect country
discover age ratings
discover cast / crew
discover director
discover scores
discover budget & revenue
disocver keywords and tropes

invalidate redis caches after update
    https://yunpengn.github.io/blog/2019/05/04/consistent-redis-sql/
invalidate vercel caches after update

report missing/wrong ratings
report missing/wrong streaming providers
report missing/wrong DNA

decide together: watch party / watch together / swipe and watch

reduce costs: show best streaming bundles for my likings

search page
explore button for media titles (prefilled discover, map feature)
random full screen: album cover (good roulette)
international / indie guides

stuck scripts monitoring
rate limit monitoring

notification when streaming is available
alerts for new search results

do not refetch stale data
    streaming links
    tv tropes
    
wrong tropes: the little mermaid (tmdb_id = 10144)
streaming missing: https://www.themoviedb.org/movie/872585-oppenheimer/watch
rotten ratings missing: http://localhost:3003/movie/1022964-candy-cane-lane
rotten score not up to date: http://localhost:3003/movie/961268-ballerina?tab=streaming
    wrong link: https://www.rottentomatoes.com/m/ballerina_2023
fury 2014, wrong rotten link: http://localhost:3003/movie/228150-fury
avengers, wrong rotten link: http://localhost:3003/movie/24428-the-avengers
my fault, 0 rotten critics score but should be null? http://localhost:3003/movie/1010581-my-fault
fringe, missing streaming: https://goodwatch.app/tv/1705-fringe
extra link for multiple in same year: https://www.rottentomatoes.com/m/nowhere_2023_2

rotten wrong urls:
    https://www.rottentomatoes.com/m/cars_2006
 -> https://www.rottentomatoes.com/m/cars
 => try different variants and compare years!
 
 metacritic false positive:
    http://localhost:3003/tv/121-doctor-who
 -> should be empty
 => compare years!
 
 tvtropes wrong years:
    https://tvtropes.org/pmwiki/pmwiki.php/Film/HitMan2023
-> searches for 2024 instead of 2023
 
identify title duplicates and run scraping again

description full text toggle
score explanations
streaming explanations
autocomplete dark style

parallax scrolling landing page
best rated picks animation
stagger animation for rating progress bars
show picks on mobile too

rating on mobile with touch/slide/drag

android app

data source: existing crawlers use existing url instead of guessing
data-source: letterboxd scores
data-source: filmstarts scores
data-source: filmstarts scores
data source: allmovie sub-genres, moods, themes, attributes, flags (https://www.allmovie.com/movie/fargo-vm422651)
data source: allmovie tones (https://www.allmovie.com/advanced-search)
data source: seasons ratings and details (flickvibe-webapp/app/routes/api/ratings/tv-seasons.tsx)
data source: imdb plotsummary + keywords
data source: user reviews (all above, flickfilosopher) 
data source: tmdb people api
data source: moviespoiler + moviepooper
data source: memes (knowyourmeme, urbandictionary, etc.9
data source: social media content (tiktok, ig, yt shorts, reddit, twitter, etc.)
data source: based on / adapted from (books, comics, ...)

GW API

socket.io updates

fix certification longer than 50 chars: 12 éven aluliak számára a megtekintése nagykorú felügyelete mellett ajánlott

issue: breaking bad streaming missing -> justwatch streaming data
issue: videos not available or not a real trailer (ip man: kung fu master, plane 2023)

analyze subtitles

```

# Search
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

# Blog
```
data pipeline with windmill: grow data and keep it up to date
    ansible for worker upgrades
db architecture: performance and scalability
caching strategy
remix: keep it simple with tailwind
monorepo design
deployment with docker compose
monitoring with uptime kuma
authentication
    https://www.dusanstam.com/posts/remix-supabase-authentication
remix component example: rating
from vercel to coolify
    too many open files
genome with LLM's
recommendation engine
```