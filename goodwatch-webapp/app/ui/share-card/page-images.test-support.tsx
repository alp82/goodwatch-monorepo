import assert from "node:assert/strict"
import { SelectedCard } from "./SelectedCard.server"
import { ScaledCard } from "./ScaledCard"
import { renderToStaticMarkup } from "react-dom/server"
import { listTileDisplay } from "~/ui/share-lists/ShareListTile"
import { DESIGNS } from "./designs"
import type { CardDesign, CardProps } from "./model"
import { cardForPage, cardWithImagePriority } from "./page-images"

const card: CardProps = {
	title: "Favorites",
	name: "Viewer",
	theme: "ember",
	date: "2026-10-29",
	items: Array.from({ length: 5 }, (_, i) => ({
		key: `movie:${i}`,
		type: "movie",
		title: `Title ${i}`,
		year: 2000,
		poster: `https://image.tmdb.org/t/p/w500/poster-${i}.jpg`,
		backdrop: `https://image.tmdb.org/t/p/w1280/backdrop-${i}.jpg`,
		genre: "Drama",
		score: 8,
	})),
}
// A saved design key selects the same implementation in the browser and the server.
const templates = import.meta.glob<Record<string, CardDesign>>("./designs/*.tsx")
for (const design of DESIGNS) {
	const module = await templates[`./designs/${design.key}.tsx`]()
	assert.equal(module[design.key], design)
	assert.equal(
		renderToStaticMarkup(<SelectedCard designKey={design.key} card={card} fill />),
		renderToStaticMarkup(<ScaledCard design={design} card={card} fill />),
	)
}
console.log(
	"__CARD_IMAGES__" +
		JSON.stringify(
			DESIGNS.map((design) => ({
				key: design.key,
				original: renderToStaticMarkup(<>{cardForPage(design, card)}</>),
				high: renderToStaticMarkup(<>{cardWithImagePriority(design, card, "high")}</>),
				responsive: renderToStaticMarkup(
					<>{cardWithImagePriority(design, card, "high", listTileDisplay(design))}</>,
				),
				lazy: renderToStaticMarkup(<>{cardWithImagePriority(design, card, "lazy")}</>),
			})),
		),
)
