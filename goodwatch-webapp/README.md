# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

### Production

Coolify builds `Dockerfile` in this directory and runs the image on port 3000. To check the image locally:

```sh
docker build -t goodwatch-webapp .
docker run --rm -p 3000:3000 --env-file .env goodwatch-webapp
```

The image must not hold secrets: the build needs none, and Coolify passes the environment when the container starts.
Keep the runtime stage free of `RUN` instructions, and keep Coolify's "Inject Build Args to Dockerfile" off.
