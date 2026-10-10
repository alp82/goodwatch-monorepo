// The page's inline script: the related map's engine, started while the document is parsed, so that taps work before
// hydration. The build bundles this file into one minified script next to the server bundle (vite.config.js), and
// the server puts it into the page after the section (see server/related-map.server.ts).
import { relatedMap } from "./map"

if (!(window as { __gwRelatedMap?: unknown }).__gwRelatedMap) relatedMap(window)
