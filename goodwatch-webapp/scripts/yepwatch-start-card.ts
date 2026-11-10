// Writes the yepwatch.com link-preview card (yepwatch-app/public/link-card.png) from link-cards.ts.
// Run after changing the start card:  node scripts/yepwatch-start-card.ts
import { writeFileSync } from "node:fs"
import { renderCard, startCard } from "../app/server/yepwatch/link-cards.ts"

const file = new URL("../../yepwatch-app/public/link-card.png", import.meta.url)
writeFileSync(file, await renderCard(startCard()))
console.log(`wrote ${file.pathname}`)
