## GoodWatch Online

GoodWatch is alive and running. Check it out: https://goodwatch.app/

## GoodWatch Community

Join our Discord to learn about the project: https://discord.gg/TVAcrfQzcA


## What's unique about GoodWatch?

1. Personalized Recommendations based on your ratings and watched movies & shows
2. Fingerprint: Classify movies and TV shows by hundreds of meaningful categories (e.g. Emotions, Plot, Subgenres, Visual Style, Cultural Context, etc.)
3. See availability of streaming services for each title (Netflix, Hulu, Amazon Prime, ...)
4. See all ratings at one place (IMDb, Metacritic, Rotten Tomatoes)

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `goodwatch-webapp/` | Remix web application (frontend + API) |
| `goodwatch-hq/` | Admin tools and internal services |
| `goodwatch-remote/` | Ansible deployment scripts and Windmill Workers |
| `goodwatch-flows/` | Windmill data pipelines and ETL workflows |
| `goodwatch-qdrant/` | Qdrant vector database for similarity search and recommendations |
| `goodwatch-crate/` | CrateDB for webapp access |
| `goodwatch-mongo/` | MongoDB for data pipeline storage |
| `goodwatch-cache/` | Redis cache cluster configuration |
| `goodwatch-metrics/` | Prometheus metrics collection |
| `goodwatch-monitoring/` | Grafana dashboards and alerting |
| `goodwatch-proxy/` | Caddy reverse proxy configuration |

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## Run Locally

### Documentation Status
The following guide is outdated. If you want to contribute to the project, please join the [Discord Community](https://discord.gg/TVAcrfQzcA).

### Getting started

Running the web app:

1. Clone this repository
2. Register for a [TMDB API Key](https://developers.themoviedb.org/3/getting-started/introduction)
3. Copy `.env.example` to `.env` from `/goodwatch-webapp` and fill out the required secrets

You are now ready to run it locally:
```shell
cd goodwatch-webapp
npm install
npm run dev
```

## Server Guide

Running the whole infrastructure to run GoodWatch is more complex. The guide below is far from complete at the moment.

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

### Adding a new Server

#### Install Packages
```
apt-get install make fzf
```

#### Install Docker
https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository

#### Git Repository
```
git clone https://github.com/alp82/goodwatch-monorepo.git
```

#### Grafana Exporter

#### Windmill Worker

#### Backup
sshfs
```
apt-get update && apt-get install sshfs
```

fstab
```
u123456-subX@u123456-subX.your-storagebox.de:/home /mnt/backup-xxx fuse.sshfs _netdev,port=23,IdentityFile=/root/.ssh/id_rsa,allow_other,reconnect,ServerAliveInterval=15,ServerAliveCountMax=3 0 0
```

uv
```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Troubleshooting

#### Not enough disc space
```
docker image prune -a
docker builder prune
```

#### Relocate docker root directory
https://www.ibm.com/docs/en/z-logdata-analytics/5.1.0?topic=compose-relocating-docker-root-directory

