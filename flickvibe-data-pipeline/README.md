# Flickvibe Data Pipeline

Collect and process all necessary data for movies and tv shows.

## Getting Started

System requirements:
* python >= 3.10
* [pdm](https://pdm.fming.dev/)
* `docker` and `docker-compose`
* optional: [pyenv](https://github.com/pyenv/pyenv) (recommended)

Install dependencies:
```
pdm install
```

Run prefect server locally:
```
pdm run prefect server start
```

Run required services locally in root folder `flickvibe-data-pipeline`:
```
docker-compose up
```

## IDE Setup

### PyCharm

1. set `/flickvibe-data-pipeline` as sources root
2. choose python interpreter from existing venv in `flickvibe-data-pipeline/.venv/bin/python`