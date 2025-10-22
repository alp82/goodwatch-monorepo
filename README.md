# GoodWatch

See it running here: https://goodwatch.app/

## What's unique about GoodWatch?

1. DNA: Classify movies and TV shows by 18 meaningful categories like Mood, Plot or Cinematic Style
2. See availability of streaming services for each title (Netflix, Hulu, Amazon Prime, ...)
3. See all ratings at one place (IMDb, Metacritic, Rotten Tomatoes)

## Documentation Status: The following guide is outdated. If you want to contribute to the project, please join the Discord Community

# https://discord.gg/TVAcrfQzcA

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

## Adding a new Server

### ssh keys

### Docker Compose

### Git Repository

### Grafana Exporter

### Windmill Worker


## Troubleshooting Servers

### Not enough disc space
```
docker image prune -a
docker builder prune
```

### Relocate docker root directory
https://www.ibm.com/docs/en/z-logdata-analytics/5.1.0?topic=compose-relocating-docker-root-directory


## Appendix

### Database Cluster

https://github.com/vitabaks/postgresql_cluster

#### pgvector extension

https://github.com/pgvector/pgvector

```
cd /tmp
git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
```

### pgvectorscale extension

https://github.com/timescale/pgvectorscale?tab=readme-ov-file#installation

TODO: install cargo version 1.75.0

```
# install prerequisites
## rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup install 1.75.0
rustup default 1.75.0
## pgrx
cargo install cargo-pgrx --version 0.11.4 --locked
cargo pgrx init --pg16 pg_config

#download, build and install pgvectorscale
cd /tmp
git clone --branch 0.3.0 https://github.com/timescale/pgvectorscale
cd pgvectorscale/pgvectorscale
export RUSTFLAGS="-C target-feature=+avx2,+fma"
cargo pgrx install --release
```

```
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;
```

### Cache Cluster

https://github.com/bitnami/containers/blob/main/bitnami/redis/README.md

```
redis-cli --cluster create 78.46.209.172:6379 168.119.242.21:6379 91.107.208.205:6379 --cluster-replicas 0 -a <REDIS_PASSWORD>
```

### Data Pipeline DB Cluster

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

### Windmill Server & Workers

TODO

## Deployment

1. Create [Vercel project](https://vercel.com/dashboard)
2. Install the [Vercel CLI](https://vercel.com/docs/cli)

Every time you want to deploy run:
```shell
vercel deploy --prod
```
