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
/discover/movie
&region
&with_rating.gte
&with_rating.lte
&with_streaming_providers
&certification.lte=0&certification_country=DE
&without_genres=
&without_keywords=

/discover/tv
&region
&with_rating.gte
&with_rating.lte
&with_streaming_providers
&with_status=Returning Series: 0, Planned: 1, In Production: 2, Ended: 3, Cancelled: 4, Pilot: 5
&with_type=Documentary: 0, News: 1, Miniseries: 2, Reality: 3, Scripted: 4, Talk Show: 5, Video: 6
&without_genres=
&without_keywords=

tv shows discover use  wrong region

discover as menu item & remove mobile profile menu items

description full text toggle

share button

image=null handling with placeholder image

vibes explanation

show other trailers and empty message if none exists

subscribe to data updates for quicker loading

tv seasons

movie predecessors and successors

fix dropdown for tabs on mobile: icons, pre-selection doesn't work

age box style: https://www.themoviedb.org/movie/16869-inglourious-basterds

autocomplete dark style

preloading search results and popular on start page

issue: breaking bad streaming missing -> justwatch streaming data

issue: tmdb imagery redundant -> justwatch imagery

issue: videos not available or not a real trailer (ip man: kung fu master, plane 2023)

show generic recommendations

director + cast

region selection

additional ratings and links:
* letterboxd
* tmdb

authentication and user profiles

connect accounts

personalized recommendation engine:
* criticker
* movielens
```
