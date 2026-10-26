// Run by tile-backdrop.test.ts through vite-node: the hub tiles' pictures as the server renders them.
import { renderToStaticMarkup } from "react-dom/server"
import { TileBackdrop, tilePriority } from "./TileBackdrop"

const path = "dcqI4l0vvGAyLsGGxobNsCVQdNK.jpg"
console.log(
	`__TILE_BACKDROP__${JSON.stringify({
		lazy: renderToStaticMarkup(<TileBackdrop path={path} priority="lazy" />),
		eager: renderToStaticMarkup(<TileBackdrop path={path} priority="eager" />),
		high: renderToStaticMarkup(<TileBackdrop path={path} priority="high" />),
		local: renderToStaticMarkup(
			<TileBackdrop
				path="/images/backdrops/backdrop-streaming-netflix.webp"
				priority="lazy"
			/>,
		),
		localEager: renderToStaticMarkup(
			<TileBackdrop
				path="/images/backdrops/backdrop-streaming-netflix.webp"
				priority="eager"
			/>,
		),
		priorities: [0, 1, 2].map((section) =>
			Array.from({ length: 10 }, (_, index) => tilePriority(section, index)),
		),
	})}`,
)
