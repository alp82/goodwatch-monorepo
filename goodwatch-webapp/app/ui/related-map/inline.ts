// The related map's engine as a script of its own. The build bundles this file into one minified script with a
// hashed name among the client build's files (vite.config.js), and a title page loads it without waiting for the
// app's own scripts (RelatedMap.tsx), so that taps work before hydration.
import { relatedMap } from "./map"

if (!(window as { __gwRelatedMap?: unknown }).__gwRelatedMap) relatedMap(window)
