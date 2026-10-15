// Preload the production fetch environment in the existing Node integration suites:
// NODE_OPTIONS="--import=$PWD/scripts/auth-integration/web-fetch.mjs" npm run test:auth:maintenance
import { installGlobals } from "@remix-run/node"
import { fillWebFetchGaps } from "../../app/server/web-fetch-gaps.server.ts"

installGlobals()
fillWebFetchGaps()
