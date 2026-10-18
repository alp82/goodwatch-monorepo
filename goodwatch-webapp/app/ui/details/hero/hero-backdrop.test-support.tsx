import { renderToStaticMarkup } from "react-dom/server"
import { HeroBackdropImage, TrailerButton, heroBackdropFiles } from "./Trailer"

const media = {
	details: { title: "Interstellar", backdrop_path: "/backdrop.jpg" },
	videos: { trailers: [{ key: "zSWdZVtXT7E" }] },
} as unknown as Parameters<typeof HeroBackdropImage>[0]["media"]

console.log(
	`__HERO_BACKDROP__${JSON.stringify({
		files: heroBackdropFiles("/backdrop.jpg"),
		trailer: renderToStaticMarkup(<TrailerButton media={media} />),
		hero: renderToStaticMarkup(
			<HeroBackdropImage media={media} className="hero" />,
		),
	})}`,
)
