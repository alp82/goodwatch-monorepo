// Shared Chromium helpers for the browser tests. Nothing is sent to Netflix:
// every https://www.netflix.com request is fulfilled locally by the test.
// Env: GOODWATCH_PLAYWRIGHT_MODULE (playwright-core index.mjs), GOODWATCH_CHROMIUM_PATH.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const moduleName = process.env.GOODWATCH_PLAYWRIGHT_MODULE
const { chromium } = await import(moduleName ? pathToFileURL(resolve(moduleName)).href : 'playwright-core')
export { chromium }
export const executablePath = process.env.GOODWATCH_CHROMIUM_PATH || chromium.executablePath()
export const sleep = ms => new Promise(r => setTimeout(r, ms))
