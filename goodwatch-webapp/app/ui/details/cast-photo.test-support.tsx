// Run by cast-photo.test.ts through vite-node: a cast photo as the title page's cast row renders it.
import { renderToStaticMarkup } from "react-dom/server"
import { TmdbImage } from "~/ui/TmdbImage"
import { CAST_PHOTO } from "./cast-photo"

console.log(
	`__CAST_PHOTO__${JSON.stringify(
		renderToStaticMarkup(
			<TmdbImage kind="profile" path="/face.jpg" {...CAST_PHOTO} alt="" />,
		),
	)}`,
)
