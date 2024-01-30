# GoodWatch

See it running here: https://www.goodwatch.app

## Getting started

1. Checkout this repository
2. Register for [TMDB API Key](https://developers.themoviedb.org/3/getting-started/introduction)
3. Copy `.env.example` to `.env` from `/goodwatch-webapp` and fill out the required secrets.

You are now ready to run it locally:
```shell
cd goodwatch-webapp
npm install
npm run dev
```

## Databases

https://github.com/vitabaks/postgresql_cluster



## Windmill Server & Workers

TODO

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

### Relocate docker root directory
https://www.ibm.com/docs/en/z-logdata-analytics/5.1.0?topic=compose-relocating-docker-root-directory
