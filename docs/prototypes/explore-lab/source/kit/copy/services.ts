import type { Deck } from "./types.ts"

// Keyed by the brand slugs of domain/new-on-services-brands.json. What each service is known for, kept to the things
// that stay true: where its catalog comes from and what it is strong in. No prices, counts or current titles.
export const SERVICES: Deck = {
	netflix: {
		short: "The biggest all-rounder, with hits from everywhere.",
		lede: "A bit of everything and a lot of it. Netflix is strongest on bingeable originals, true crime, stand-up, and series from around the world that end up as everyone's obsession. If you're not sure what you want, it's a fair place to start browsing.",
	},
	"amazon-prime": {
		short: "A huge, mixed library with a few big swings.",
		lede: "A sprawling catalog where prestige originals sit next to action favorites and deep-cut oldies. Prime Video rewards digging: there's far more in here than the home screen lets on. Good for big-budget series and movies you forgot you wanted to see.",
	},
	"disney-plus": {
		short: "Disney, Pixar, Marvel, and Star Wars at home.",
		lede: "The home of Disney animation, Pixar, Marvel, and Star Wars, with nature documentaries on the side. It's the easy answer for family night and for anyone following a franchise. Comfort rewatches guaranteed.",
	},
	"hbo-max": {
		short: "Prestige drama and a deep movie library.",
		lede: "The home of HBO, which means the dramas and comedies people argue about on Monday morning. Around them sits a strong movie library with studio classics, DC heroes, and recent releases. Quality over quantity.",
	},
	"apple-tv": {
		short: "A small catalog where most things are good.",
		lede: "Fewer titles than the giants, but almost all of them are originals made with care and money. Apple TV is especially good for polished dramas, clever comedies, and ambitious science fiction. Easy to browse, hard to pick badly.",
	},
	hulu: {
		short: "Current TV, sharp originals, plenty of comedy.",
		lede: "A US service that built its name on current TV, then added originals with real bite. It's strong on comedy, adult animation, and dramas that get people talking. A solid pick when you want a series more than a movie.",
	},
	peacock: {
		short: "NBC and Universal favorites in one place.",
		lede: "The streaming home of NBC and Universal. That means classic sitcoms to rewatch, reality franchises, live sports, and Universal movies after their run in theaters. Comfort TV is its strong suit.",
	},
	"paramount-plus": {
		short: "Star Trek, CBS dramas, and Paramount movies.",
		lede: "Paramount movies, CBS procedurals, Nickelodeon for the kids, and more Star Trek than anywhere else. It leans on big familiar names and gritty original dramas. A good fit for franchise fans.",
	},
	crunchyroll: {
		short: "Anime, and lots of it.",
		lede: "If it's anime, it's probably here: long-running hits, new episodes fresh from Japan, and plenty of hidden gems. Subtitled or dubbed, your choice. The place to start if you're curious and the place to stay if you're hooked.",
	},
	mubi: {
		short: "Hand-picked cinema for people who love film.",
		lede: "A curated collection of arthouse, festival, and classic films from around the world. Things come and go, and everything is chosen by people instead of an algorithm. For nights when you want a film, not content.",
	},
}

export const SERVICE_ALIASES: Record<string, string> = {
	"amazon-prime-video": "amazon-prime",
	"prime-video": "amazon-prime",
	disney: "disney-plus",
	max: "hbo-max",
	hbo: "hbo-max",
	"apple-tv-plus": "apple-tv",
	paramount: "paramount-plus",
}
