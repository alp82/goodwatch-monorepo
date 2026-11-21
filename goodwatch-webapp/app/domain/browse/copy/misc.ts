import type { Deck } from "./types.ts"

// Best: the ranked list. One entry, "all".
export const BEST: Deck = {
	all: {
		movies: {
			short: "The all-time greats, ranked.",
			lede: "The movies that critics and audiences agree on, across every source we follow. Old masters and modern classics side by side, ranked by how consistently they're loved. If you've been meaning to fill the gaps, start at the top.",
		},
		shows: {
			short: "The greatest series ever made, ranked.",
			lede: "The series that keep landing at the top, whether you ask critics or viewers. Landmark dramas, perfect comedies, and anime that earned its reputation. Each one is a commitment, and each one is worth it.",
		},
		all: {
			short: "The greatest movies and series, ranked.",
			lede: "The movies and series that critics and audiences agree on, across every source we follow. Old masters, landmark dramas, and modern classics side by side, ranked by how consistently they're loved. If you've been meaning to fill the gaps, start at the top.",
		},
	},
}

// The hub ("home") and the page of each family, such as Movies by mood.
export const HUB: Deck = {
	home: {
		movies: {
			short: "Find a movie by mood, genre, era, or place.",
			lede: "Start with how you feel, what you love, or where and when it was made. Every door leads to movies worth your evening.",
		},
		shows: {
			short: "Find a show by mood, genre, era, or place.",
			lede: "Start with how you feel, what you love, or where and when it was made. Every door leads to a series worth starting tonight.",
		},
		all: {
			short: "Find a movie or a show by mood, genre, era, or place.",
			lede: "Start with how you feel, what you love, or where and when it was made. Every door leads to something worth your evening, whether it runs two hours or two seasons.",
		},
	},
	moods: {
		movies: {
			short: "Pick by how you want to feel.",
			lede: "Forget genres for a minute. How do you want to feel when the credits roll? Pick a mood and go from there.",
		},
		shows: {
			short: "Pick by how you want to feel.",
			lede: "Forget genres for a minute. What kind of evening is this, and how many episodes do you have in you? Pick a mood and go from there.",
		},
		all: {
			short: "Pick by how you want to feel.",
			lede: "Forget genres for a minute. How do you want to feel tonight, and do you have two hours or a whole weekend? Pick a mood and go from there.",
		},
	},
	genres: {
		short: "The shelves you know by heart.",
		lede: "The shelves you know from every video store. Each one is bigger and stranger inside than its label suggests.",
	},
	themes: {
		short: "Pick by what the story is about.",
		lede: "Sometimes you know exactly what you want a story to be about: a heist, a family, a war, the future. This is where to find it.",
	},
	styles: {
		short: "Pick by how the story is told.",
		lede: "Not what it's about, but how it's made: animated or filmed, slow or fast, talky or loud. For when the feel matters more than the plot.",
	},
	decades: {
		movies: {
			short: "Travel by decade.",
			lede: "Every decade of movies has its own look, its own fears, and its own idea of fun. Pick an era and see what people were lining up for.",
		},
		shows: {
			short: "Travel by decade.",
			lede: "Every decade of television has its own rhythm, from live broadcasts to weekend binges. Pick an era and see what people were tuning in for.",
		},
		all: {
			short: "Travel by decade.",
			lede: "Every decade has its own look, its own fears, and its own idea of fun, on the big screen and the small one. Pick an era and see what people were lining up for and tuning in to.",
		},
	},
	countries: {
		movies: {
			short: "Travel the world from your couch.",
			lede: "Great movies come from everywhere, and every country tells stories its own way. Pick a place on the map and see what it's known for.",
		},
		shows: {
			short: "Travel the world from your couch.",
			lede: "Great series come from everywhere, and every country tells stories its own way. Pick a place on the map and see what it's known for.",
		},
		all: {
			short: "Travel the world from your couch.",
			lede: "Great stories come from everywhere, and every country tells them its own way. Pick a place on the map and see what it's known for.",
		},
	},
	services: {
		short: "See what's good where you already subscribe.",
		lede: "Every streaming service has its own personality. See what each one does best, and what's worth your time there.",
	},
	best: {
		movies: {
			short: "The all-time greats, ranked.",
			lede: "The movies almost everyone agrees on. Start at the top and work your way down.",
		},
		shows: {
			short: "The greatest series ever made, ranked.",
			lede: "The series almost everyone agrees on. Start at the top and work your way down.",
		},
		all: {
			short: "The all-time greats, ranked.",
			lede: "The movies and series almost everyone agrees on. Start at the top and work your way down.",
		},
	},
}
