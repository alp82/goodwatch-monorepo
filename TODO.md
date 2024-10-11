# TODO's
```
---

discover sidebar redesign
    bug multiple genres duplicated
    subheader
    blocks with filter names and subtle bg in a grid
    https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering
    https://flowbite.com/blocks/application/table-headers/#multi-level-table-header-with-filters
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

discover
    all | movies | tv
    return count: "showing first 100 results"
    streaming types: mine, free, buy, all
    discover loading animation with skeletons
    
---

details
    share button sticky
    guess country
    age restriction by country
    streaming section country flag button does not change selected country
    streaming section favors user selected providers
    web links section
    
    show title in current language
    images section
    images and videos as gallery
    https://www.figma.com/design/1sIRD12ImqTbC6lI396gWA/IMDb-Redesign-(Community)?node-id=0-1&t=DM0lDYiEkBYUsMZY-0

    empty sections:
        http://localhost:3003/movie/46388-a-ghost-of-a-chantz
        http://localhost:3003/movie/1261489-betrayal
        http://localhost:3003/movie/974995-identity 
    mobile: user action buttons below poster directly
    https://imdb.shyakadavis.me/title#overview

    fragment for scroll position (auto update)

---

slow network emulation
    skeleton loading
    useQuery

---

onboarding
    better instructions for step 2
    card titles above poster (better for long titles)
    Search slow and bad at long ones like "orange is the new black"
    
    better mobile support
        Drag rating not working
        Smaller text above
        Button sticky
        search not focused (only on mobile?) 
        Double skip button at the bottom
    
    Success notification for milestones
    
---

header
    main search expand
    subnav row with search and default filters
        https://flowbite.com/blocks/application/navbar/#double-navigation-bar-with-search-input
    
---

home screen
    user: trending, watch next, etc.
    stagger animation for rating progress bars

---

explore
    useQuery
    progress text (generating results...)
    streaming config (providers + country ...)

---

vector save
    python normalization fix 'S typos

---

redis optional

---

postgres cluster config in repo
    https://github.com/vitabaks/postgresql_cluster
    
---

remove weaviate

---

similarity for movie/tv details by DNA vector category

	const pg_query = `
    SELECT
      COALESCE(m.tmdb_id, t.tmdb_id) AS tmdb_id,
			COALESCE(m.title, t.title) AS title,
			COALESCE(m.release_year, t.release_year) AS release_year,
			COALESCE(m.poster_path, t.poster_path) AS poster_path,
			COALESCE(m.streaming_providers, t.streaming_providers) AS streaming_providers,
			
      (
				SELECT json_agg(json_build_object(
					'provider_id', spl.provider_id,
					'provider_name', sp.name,
					'provider_logo_path', sp.logo_path,
					'media_type', spl.media_type,
					'country_code', spl.country_code,
					'stream_type', spl.stream_type
				))
				FROM streaming_provider_links spl
				INNER JOIN streaming_providers sp ON sp.id = spl.provider_id
				WHERE spl.tmdb_id = COALESCE(m.tmdb_id, t.tmdb_id)
				AND spl.media_type = $1
				AND spl.country_code = $2
				AND spl.provider_id NOT IN (24,119,188,210,235,350,380,390,524,1796,2100)
			) AS streaming_links,
		
      ${getRatingKeys()
				.map((key) => `COALESCE(m.${key}, t.${key}) AS ${key}`)
				.join(", ")}
      
    -- TODO SIMILAR FOR DETAILS
		FROM (
			SELECT ${category}_vector
			FROM vectors_media
			WHERE tmdb_id = 603 AND media_type = 'movie'
		) sv
	
		CROSS JOIN LATERAL (
			SELECT v.*
			FROM vectors_media v
			WHERE v.${category}_vector IS NOT NULL
			ORDER BY v.${category}_vector <=> sv.${category}_vector ASC
			LIMIT ${RESULT_LIMIT}
		) v
		
		LEFT JOIN movies m ON m.tmdb_id = v.tmdb_id AND v.media_type = 'movie'
		LEFT JOIN tv t ON t.tmdb_id = v.tmdb_id AND v.media_type = 'tv'
  `

---

data flows ignore list:
    no release_year
    no poster_path
    no title

---

tv seasons:
    get episodes
    get ratings
    show in details
    when last season/episode was released

---

sign up
    via email
    via apple

---

command palette

---

similarity issues
    dark palette is close to vibrant palette
    http://localhost:3003/explore/all/cinematic_style/Dark%20Palette

---

wishlist
    not logged in handling
    split into two sections:
        watch now
        rest
    search & filter
    easy adding more

watched/ratings page:
    rating stats (1-10 distribution)
    search & filter
    easy rating more

favorites page
    search & filter
    easy adding more

---

DNA infobox with Discord link

---

For You
    Landing page with examples
    Personal Recommendations by DNA category

---

Show User Data In Movie Cards
    Trending
    Explore
    Discover
    Collections
    etc.

---

use connection pooling properly
    postgres
    redis

---

redesigned footer
    community blocks
    https://flowbite.com/blocks/marketing/footer/

---

mongodb backups
    daily to hetzner storage

---

new page: started this week on your streaming services

---

secret handling
project documentation

---

letterboxd ratings

---

country usage
    new hook with user setting, guess and locale
    details
    explore
    discover
    trending

---

analyze slow indexes

SELECT 
  *
FROM 
  pg_stat_statements 
WHERE 
  query LIKE '%vectors_media%'
LIMIT 20;
  
---

referrer paths
    https://chatgpt.com/c/66f241ee-6c20-8001-8b0f-aefbcaefc2bc

---

init scripts only insert new and ignore existing ids
    copy/combine scripts only copy diffs to postgres


---

translated titles in current language
    all cards
    onboarding ratings
    details with alternative titles block
    search, discover and explore

---

offline support

---

achievements
    user level + xp
    rating count: 10, 20 etc.

---

postgres cluster health check
    SELECT 1 FROM pg_replication_slots WHERE active = 'true' AND slot_name = 'pgnode01';

---

explore tag alternatives:
    SELECT 
        value_text, 
        COUNT(*) AS value_count
    FROM (
        SELECT jsonb_array_elements_text(dna->'Place') AS value_text
        FROM movies
        WHERE dna->'Place' IS NOT NULL
    ) AS subquery
    GROUP BY value_text
    ORDER BY value_count DESC
    LIMIT 200;

---

streaming providers from tmdb api with all country ranks
    remove old scripts and schedules
    
streaming_provider_rank
    rename to streaming_provider_countries
    
---

guides (explore shortcuts)
    by genre
    by mood
    etc.
    
guide of the day

---

stats
    # of movies
    # of tv shows
    # of ratings per site
    # of streaming links
    # of tropes
    avg rating per provider
    oldest fetch date
        date distribution

---

all titles from a-z (search page?)
    difference between search, explore, discover, watch next, etc.?
    
---
    
clips
    tiktok
    youtube shorts
    reels
    
---

server resource monitoring
    https://grafana.com/orgs/coinmatica/stacks/800134

tvtropes number to string conversion
    https://chatgpt.com/g/g-FZtypBX5c-goodwatch-ai/c/9871cbb0-ca78-46a6-8cd1-732519e36f6e

posthog custom events
    https://posthog.com/tutorials/remix-analytics#capturing-custom-events

error handling: http://localhost:3003/tv/252146-who-killed-him
    fallback?
    priority?
    https://www.themoviedb.org/tv/252146-quien-lo-mato

DNA tag user weights
    click on most loved/hated aspects for recommendations

user notes/comments
    use for LLM input for recommendations

playwright tests

anime
    https://anidb.net/
    https://anibrain.ai/
    https://www.anisearch.de/
    https://www.anime-planet.com/
    
other sites
    https://simkl.com/
    https://www.thetvdb.com/
    https://mdblist.com/
    https://letterboxd.com/film/beetlejuice-beetlejuice/nanogenres/
    https://nanocrowd.com/
    https://app.nanocrowd.com/
    https://tastedive.com/
    
other api's
    https://mdblist.docs.apiary.io/#reference/0/media-info/get-media-info

redistribute weight for gw score

more lightweight user data

detailed watchlists
    https://docs.simkl.org/how-to-use-simkl/basic-features/watchlists-and-custom-lists#how-are-notifications-handled-for-each-watchlist

refresh data request
    show oldest last refreshed date
    badge with counter
    email once finished

notification when streaming is available (country + streaming)
alerts for new search results

combined collection score

fix all linting errors

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

show titles on map (production countries + places in film)
    where to show space and fantasy places

populate trending score 1-500
save trending scores per day
trending yesterday
trending difference

details:
box office (e.g. Google)
crew links to discovery
awards (grab from API)

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

do not refetch stale data
    streaming links
    tv tropes
    
live rating events
    chatbox
    countdown
    
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

zombie processes:
    alternate approach: MAX_WAIT_FOR_SIGINT=1
    https://github.com/windmill-labs/windmill/issues/4198

score explanations
streaming explanations

android app
iphone app

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

Blog Posts Page
    https://flowbite.com/docs/components/jumbotron/#jumbotron-with-cards

GoodWatch API

socket.io updates

fix certification longer than 50 chars
    12 éven aluliak számára a megtekintése nagykorú felügyelete mellett ajánlott

issue: breaking bad streaming missing -> justwatch streaming data
issue: videos not available or not a real trailer (ip man: kung fu master, plane 2023)

analyze subtitles

other media
    games
    music
    podcasts
    books
    audio books

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
monorepo design
db architecture: performance and scalability
caching strategy
from vercel to coolify
    too many open files
remix: keep it simple with tailwind
    linting with biomejs
    component example: rating
data pipeline with windmill: grow data and keep it up to date
server architecture
    deployment with docker compose
    ansible for worker upgrades
monitoring with uptime kuma
authentication
    https://www.dusanstam.com/posts/remix-supabase-authentication
genome with LLM's
recommendation engine
zombie processes
    windmill -> chrome (playwright)
    "can't start new thread"
    "IO error: Resource temporarily unavailable (os error 11)"
    kill windmill every 24 hours
```