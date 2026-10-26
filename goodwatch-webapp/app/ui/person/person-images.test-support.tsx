// Run by person-images.test.ts through vite-node: the person page's filmography poster and header portrait as the
// server renders them, before (the grid's own sizes, the portrait at a fixed width) and after (person-images.ts).
import { renderToStaticMarkup } from "react-dom/server"
import { Poster } from "~/ui/Poster"
import { Portrait } from "./Portrait"
import { PERSON_GRID_POSTER, PERSON_PORTRAIT } from "./person-images"

const poster = (extra: Record<string, unknown>) =>
	renderToStaticMarkup(
		<Poster
			path="/poster.jpg"
			title="T"
			lang="en"
			mediaType="movie"
			tmdbId={1}
			{...extra}
		/>,
	)
console.log(
	`__PERSON_IMAGES__${JSON.stringify({
		posterBefore: poster({}),
		posterAfter: poster({
			sizes: PERSON_GRID_POSTER.sizes,
			minWidth: PERSON_GRID_POSTER.minWidth,
		}),
		portraitBefore: renderToStaticMarkup(
			<Portrait path="/face.jpg" name="N" width={120} className="" />,
		),
		portraitAfter: renderToStaticMarkup(
			<Portrait path="/face.jpg" name="N" className="" {...PERSON_PORTRAIT} />,
		),
	})}`,
)
