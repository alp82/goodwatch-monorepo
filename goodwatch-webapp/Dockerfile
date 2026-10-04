# syntax=docker/dockerfile:1
# Production image for the webapp. Coolify builds it with this directory as the build context.
#
# The dependency layers depend only on package.json, package-lock.json, .npmrc and patches/, so a commit that changes
# only app code reuses them and only runs the Vite build.
#
# The search query models (882 MB) are in the image, in their own stage and layer. That stage depends only on the model
# list (query-models.server.ts) and the fetch script, so it downloads once per build host and stays cached after that.
# No volume is needed for them: a container on any host starts its encoder without a download.
#
# Secrets: the build needs no secrets. The runtime stage has no RUN instruction, so build arguments that Coolify passes
# or injects as ARG lines can't end up in the image's history. Runtime environment variables come from Coolify when the
# container starts. One of them is SOURCE_COMMIT, the build's commit: the image doesn't hold it, and nothing reads it at
# build time (see "The build's commit" in docs/webapp-deploys.md).

ARG NODE_IMAGE=node:24-bookworm-slim

# All dependencies, for the build.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY patches ./patches
RUN --mount=type=cache,id=goodwatch-webapp-npm,target=/root/.npm \
	npm ci --include=dev --no-audit --no-fund

# Production dependencies only, for the runtime image. onnxruntime-node ships its Linux x64 CPU binary in the package;
# .npmrc skips its CUDA download.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY patches ./patches
RUN --mount=type=cache,id=goodwatch-webapp-npm,target=/root/.npm \
	npm ci --omit=dev --no-audit --no-fund

# The search query model files, downloaded from Hugging Face at the pinned revisions and checked against the pinned
# SHA-256 hashes by the same code that the app runs. A failed download or a wrong hash fails the build. Keep this
# stage's inputs to these two files: any other input would repeat the download on unrelated changes.
FROM ${NODE_IMAGE} AS models
WORKDIR /src
COPY app/server/search-ranking/query-models.server.ts app/server/search-ranking/
COPY scripts/fetch-search-models.mjs scripts/
RUN node scripts/fetch-search-models.mjs /data/gw-search-models

FROM deps AS build
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
WORKDIR /app
# SEARCH_MODEL_DIR is where the app looks for the model files. An environment variable at container start overrides
# it; a directory without the files makes the app download them at its start.
ENV NODE_ENV=production \
	PORT=3000 \
	SEARCH_MODEL_DIR=/data/gw-search-models
# Coolify's health check runs `curl` or `wget` inside the container, and the slim image has neither. BusyBox is static and
# acts as wget under that name.
COPY --from=busybox:1.37-musl /bin/busybox /usr/local/bin/wget
# Before the dependencies and the build, so that this layer is the same in every image and is stored once per host.
COPY --from=models /data/gw-search-models /data/gw-search-models
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
EXPOSE 3000
CMD ["node_modules/.bin/remix-serve", "./build/server/index.js"]
