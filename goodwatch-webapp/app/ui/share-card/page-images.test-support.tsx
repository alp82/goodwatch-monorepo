import { renderToStaticMarkup } from "react-dom/server"
import { listTileDisplay } from "~/ui/share-lists/ShareListTile"
import { DESIGNS } from "./designs"
import type { CardProps } from "./model"
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
console.log(
	"__CARD_IMAGES__" +
		JSON.stringify(
			DESIGNS.map((design) => ({
				key: design.key,
				original: renderToStaticMarkup(<>{cardForPage(design, card)}</>),
				high: renderToStaticMarkup(
					<>{cardWithImagePriority(design, card, "high")}</>,
				),
				responsive: renderToStaticMarkup(
					<>
						{cardWithImagePriority(
							design,
							card,
							"high",
							listTileDisplay(design),
						)}
					</>,
				),
				lazy: renderToStaticMarkup(
					<>{cardWithImagePriority(design, card, "lazy")}</>,
				),
			})),
		),
)
