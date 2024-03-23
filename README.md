# GoodWatch

See it running here: https://goodwatch.app/

## What's unique about GoodWatch?

1. Discover page tailored to your needs
2. See all ratings at one place
3. See all streaming services at one place (similar to JustWatch)
4. See score for whole series of movies at one glance

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

## Database Cluster

https://github.com/vitabaks/postgresql_cluster


## Cache Cluster

https://github.com/bitnami/containers/blob/main/bitnami/redis/README.md

```
redis-cli --cluster create 78.46.209.172:6379 168.119.242.21:6379 91.107.208.205:6379 --cluster-replicas 0 -a <REDIS_PASSWORD>
```

## Data Pipeline DB Cluster

https://medium.com/workleap/the-only-local-mongodb-replica-set-with-docker-compose-guide-youll-ever-need-2f0b74dd8384

```
openssl rand -base64 756 > mongodb-keyfile
```


https://github.com/csuka/ansible_role_mongodb_ubuntu

```
ansible-galaxy collection install community.mongodb
ansible-galaxy install csuka.mongodb_ubuntu
ansible-playbook -i inventory.ini playbook.yml
```

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
