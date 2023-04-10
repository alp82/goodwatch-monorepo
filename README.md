# flickvibe

See it running here: https://www.flickvibe.com/

## Getting started

1. Checkout this repository
2. Register for [TMDB API Key](https://developers.themoviedb.org/3/getting-started/introduction)
3. Create [supabase account](https://app.supabase.com/)
4. Copy `.env.example` to `.env` and fill out the required secrets.

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


## TODO's
```
data sources:

tmdb_daily
tmdb_details
tmdb_collections
tmdb_people

imdb_ratings
metacritic_ratings
rotten_tomatoes_ratings

tvtropes_tags
```

```
people query
https://api.themoviedb.org/3/person/1331163?api_key=df95f1bae98baaf28e1c06d7a2762e27&append_to_response=external_ids,%20images,tagged_images,translations
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
  movie_details.*, 
  (
	COALESCE(rank_title, 0) * 10 + 
	COALESCE(rank_alternative_titles, 5) +
	COALESCE(rank_tagline, 0) * 4 + 
	COALESCE(rank_description, 0) * 2 +
	1 / (1 + exp(-10*(COALESCE(similarity, 0)-0.5))) * log10(popularity + 1)
  ) weighted_rank
FROM 
  movie_details
LEFT JOIN (
  SELECT 
    id, 
    ts_rank_cd(to_tsvector('english', unaccent(original_title)), plainto_tsquery('english', query)) as rank_title, 
    ts_rank_cd(to_tsvector('english', unaccent(tagline)), plainto_tsquery('english', query)) as rank_tagline, 
    ts_rank_cd(to_tsvector('english', unaccent(overview)), plainto_tsquery('english', query)) as rank_description,
	ts_rank_cd(to_tsvector('english', unaccent(string_agg(DISTINCT alternative_titles.alternative_title::text, ' '))), plainto_tsquery('english', query)) as rank_alternative_titles,
    word_similarity(query, original_title) as similarity
  FROM 
    movie_details,
	search_query,
	LATERAL (SELECT jsonb_array_elements(alternative_titles->'titles')->>'title'::text AS alternative_title) AS alternative_titles
  GROUP BY id, query
) as ranks ON movie_details.id = ranks.id
WHERE 
  ranks.rank_title > 0 OR 
  ranks.rank_alternative_titles > 0 OR
  ranks.rank_tagline > 0 OR 
  ranks.rank_description > 0 OR 
  similarity > 0
ORDER BY 
  weighted_rank DESC NULLS LAST 
LIMIT 20;
```

```
SELECT * FROM movie_details WHERE (ratings->'imdbRatings'->>'score')::float > 0 ORDER BY ratings->'imdbRatings'->>'score' DESC

SELECT * FROM movie_details WHERE (tvtropes->>'url') is null ORDER BY id ASC

/discover/movie
&certification.lte=0&certification_country=DE

/discover/tv
&with_status=Returning Series: 0, Planned: 1, In Production: 2, Ended: 3, Cancelled: 4, Pilot: 5
&with_type=Documentary: 0, News: 1, Miniseries: 2, Reality: 3, Scripted: 4, Talk Show: 5, Video: 6

rotten tomatoes matching (id datasets)

report missing ratings

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

authentication and user profiles

connect accounts

personalized recommendation engine:
* criticker
* movielens
```
