// Builds the console snippet the owner pastes on justwatch.com. Run: node prototypes/justwatch-wishlist/build-snippet.mjs
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

const core = readFileSync(new URL("./capture-core.js", import.meta.url), "utf8").replace(/^export /gm, "")
const runner = readFileSync(new URL("./browser-runner.js", import.meta.url), "utf8")
const snippet = `// GoodWatch #708 JustWatch Watchlist capture. Read-only: it sends list queries to ${"https://apis.justwatch.com/graphql"} and nothing else.
// It reads your JustWatch sign-in from this tab, never stores or downloads it, and saves one JSON file to your Downloads folder.
(async () => {
${core}
${runner}
})()
`
const target = new URL("./snippet/justwatch-capture.snippet.js", import.meta.url)
writeFileSync(target, snippet)
console.log(`${target.pathname}\nsha256 ${createHash("sha256").update(snippet).digest("hex")}`)
