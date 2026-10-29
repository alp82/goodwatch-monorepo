import { renderToStaticMarkup } from "react-dom/server"
import { HeroBackdropImage, heroBackdropFiles } from "./Trailer"
import { heroBackdropSource } from "./hero-backdrop"

const media = {
	details: { title: "Interstellar", backdrop_path: "/backdrop.jpg" },
	videos: { trailers: [{ key: "zSWdZVtXT7E" }] },
} as unknown as Parameters<typeof HeroBackdropImage>[0]["media"]

console.log(
	`__HERO_BACKDROP__${JSON.stringify({
		files: heroBackdropFiles("/backdrop.jpg"),
		preload: heroBackdropSource("/backdrop.jpg"),
		hero: renderToStaticMarkup(
			<HeroBackdropImage media={media} className="hero" />,
		),
	})}`,
)
