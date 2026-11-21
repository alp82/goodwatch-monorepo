// Plain section headings the concepts share. A heading names the thing under it and nothing else: no counts, no
// "and what makes each", no wordplay. Where a heading takes a name, pass it as it reads in a sentence ("cozy
// movies", "the 1990s", "Netflix").
export const headings = {
	// Lists of titles
	popular: "Popular right now",
	newest: "Just released",
	best: "The best of all time",
	bestOf: (what: string) => `The best ${what}`,
	essential: (what: string) => `Essential ${what}`,
	all: (what: string) => `All ${what}`,
	onYourServices: "On your services",

	// What a place is like
	setsApart: "What sets it apart",
	kindsOf: (what: string) => `Kinds of ${what}`,
	knownFor: (name: string) => `What ${name} is known for`,
	about: (era: string) => `What ${era} were about`,
	howMuch: (trait: string) => `How ${trait}?`,

	// Where to go next
	closeTo: (name: string) => `Close to ${name}`,
	goesWith: (name: string) => `Goes well with ${name}`,
	people: "The people behind them",
	awards: "Award winners",
	onTheMap: "See it on the map",
	moreFilters: "More filters in Discover",

	// The families
	moods: "By mood",
	genres: "By genre",
	themes: "By subject",
	styles: "By style",
	decades: "By decade",
	countries: "By country",
	services: "By streaming service",
} as const

export type Headings = typeof headings
