# syntax=docker/dockerfile:1
# Production image for the webapp. Coolify builds it with this directory as the build context.
#
# The dependency layers depend only on package.json, package-lock.json, .npmrc and patches/, so a commit that changes
# only app code reuses them and only runs the Vite build.
#
# Secrets: the build needs no secrets. The runtime stage has no RUN instruction, so build arguments that Coolify passes
# or injects as ARG lines can't end up in the image's history. Runtime environment variables come from Coolify when the
# container starts.

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

FROM deps AS build
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production \
	PORT=3000
# Coolify's health check runs `curl` or `wget` inside the container, and the slim image has neither. BusyBox is static and
# acts as wget under that name.
COPY --from=busybox:1.37-musl /bin/busybox /usr/local/bin/wget
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
EXPOSE 3000
CMD ["node_modules/.bin/remix-serve", "./build/server/index.js"]
