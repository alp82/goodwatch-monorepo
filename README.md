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
https://leandronsp.com/a-powerful-full-text-search-in-postgresql-in-less-than-20-lines
https://rachbelaid.com/postgres-full-text-search-is-good-enough/
https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-HEADLINE

CREATE EXTENSION pg_trgm
(similarity)

CREATE EXTENSION unaccent
(unaccent(...))

CREATE INDEX movie_details_search_idx ON movie_details USING GIN (to_tsvector(movie_details.original_title || movie_details.tagline || movie_details.overview))

SELECT
	movie_details.*,
	rank_title,
    rank_tagline,
    rank_description,
    similarity,
	(
		COALESCE(rank_title, 0) * 100 * popularity + 
		COALESCE(rank_tagline, 0) * 20 * popularity + 
		COALESCE(rank_description, 0) * 10 * popularity + 
		COALESCE(similarity, 0) * ln(cbrt(popularity))
	) weighted_rank
FROM
	movie_details,
	to_tsvector(
		unaccent(movie_details.original_title) || 
		unaccent(movie_details.tagline) || 
		unaccent(movie_details.overview)
	) document,
    to_tsquery('ava') query,
	NULLIF(ts_rank_cd(to_tsvector(movie_details.original_title), query), 0) rank_title,
	NULLIF(ts_rank_cd(to_tsvector(movie_details.tagline), query), 0) rank_tagline,
	NULLIF(ts_rank_cd(to_tsvector(movie_details.overview), query), 0) rank_description,
	word_similarity('ava', movie_details.original_title) similarity
WHERE query @@ document OR similarity > 0
ORDER BY weighted_rank DESC NULLS LAST
LIMIT 20
```

```
SELECT * FROM movie_details WHERE (ratings->'imdbRatings'->>'score')::float > 0 ORDER BY ratings->'imdbRatings'->>'score' DESC

SELECT * FROM movie_details WHERE (tvtropes->>'url') is null ORDER BY id ASC

/discover/movie
&certification.lte=0&certification_country=DE

/discover/tv
&with_status=Returning Series: 0, Planned: 1, In Production: 2, Ended: 3, Cancelled: 4, Pilot: 5
&with_type=Documentary: 0, News: 1, Miniseries: 2, Reality: 3, Scripted: 4, Talk Show: 5, Video: 6

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
