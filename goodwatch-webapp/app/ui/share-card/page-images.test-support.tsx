import { renderToStaticMarkup } from "react-dom/server"
import { DESIGNS } from "./designs"
import type { CardProps } from "./model"
import { cardWithImagePriority } from "./page-images"

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
				original: renderToStaticMarkup(<design.Card {...card} />),
				high: renderToStaticMarkup(
					<>{cardWithImagePriority(design, card, "high")}</>,
				),
				lazy: renderToStaticMarkup(
					<>{cardWithImagePriority(design, card, "lazy")}</>,
				),
			})),
		),
)
