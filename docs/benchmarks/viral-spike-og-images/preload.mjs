// Loads the render profile's measurement preload (../viral-spike-render-profile/prof-preload.mjs) in the web server
// process only. NODE_OPTIONS also reaches the card renderer's child processes and the query encoder's worker thread,
// where the preload's control port is already taken and the process would exit.
import { isMainThread } from "node:worker_threads"
if (isMainThread && !process.send) await import("./prof-preload.mjs")
