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
