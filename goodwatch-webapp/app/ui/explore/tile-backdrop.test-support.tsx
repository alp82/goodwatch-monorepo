// Run by tile-backdrop.test.ts through vite-node: the hub tiles' pictures as the server renders them.
import { renderToStaticMarkup } from "react-dom/server"
import { TileBackdrop } from "./TileBackdrop"

console.log(
	`__TILE_BACKDROP__${JSON.stringify({
		tmdb: renderToStaticMarkup(
			<TileBackdrop path="dcqI4l0vvGAyLsGGxobNsCVQdNK.jpg" />,
		),
		local: renderToStaticMarkup(
			<TileBackdrop path="/images/backdrops/backdrop-streaming-netflix.webp" />,
		),
	})}`,
)
