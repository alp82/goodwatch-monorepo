# flickvibe

See it running here: https://www.flickvibe.com/

## Getting started

1. Checkout this repository
2. Register for [TMDB API Key](https://developers.themoviedb.org/3/getting-started/introduction)
3. Create [supabase account](https://app.supabase.com/)
4. Copy `.env.example` to `.env` from `/flickvibe-webapp` and fill out the required secrets.

You are now ready to run it locally:
```shell
cd flickvibe-webapp
npm install
npm run dev
```

## Deployment

1. Create [Vercel project](https://vercel.com/dashboard)
2. Install the [Vercel CLI](https://vercel.com/docs/cli)

Every time you want to deploy run:
```shell
vercel deploy --prod
```


## Troubleshooting Server

### Not enough disc space
```
docker image prune -a
docker builder prune
```


## TODO's
```
data sources:

existing crawlers: use existing url instead of guessing
tmdb justwatch streaming crawler
allmovie moods and themes

tmdb people api
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

```
fix certification longer than 50 chars: 12 éven aluliak számára a megtekintése nagykorú felügyelete mellett ajánlott

SELECT * FROM movie_details WHERE (ratings->'imdbRatings'->>'score')::float > 0 ORDER BY ratings->'imdbRatings'->>'score' DESC

SELECT * FROM movie_details WHERE (tvtropes->>'url') is null ORDER BY id ASC

sort by random

rotten tomatoes matching (imdb to rt id datasets)

report missing ratings

start page: https://tailwindui.com/components/marketing/sections/heroes#component-d63f5b5552a3f3d936c6ab970a47899b

description full text toggle

share button

vibes explanation

show generic recommendations

director + cast

region selection

preloading search results and popular on start page

issue: breaking bad streaming missing -> justwatch streaming data

issue: tmdb imagery redundant -> justwatch imagery

issue: videos not available or not a real trailer (ip man: kung fu master, plane 2023)

fix dropdown for tabs on mobile: icons

image=null handling with placeholder image

autocomplete dark style

additional ratings and links:
* letterboxd
* tmdb

explore map

authentication and user profiles

connect accounts

notification when streaming is available

alerts for new search results

personalized recommendation engine:
* criticker
* movielens
```
