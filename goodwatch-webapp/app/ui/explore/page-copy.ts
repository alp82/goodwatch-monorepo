// The heading and the intro of the category pages: `/<type>`, `/<type>/<category>`, and `/<type>/<category>/<page>`.
// Both are in the server HTML, so a crawler reads what the page is about. They are built from the category
// definitions and only say what the lists do: each starts with the most popular titles.
import type { NavType, PageData } from "~/ui/explore/config"
import { mainHierarchy, mainNavigation } from "~/ui/explore/main-nav"

export interface PageCopy {
	heading: string
	intro: string
}

type Category = keyof typeof mainHierarchy

const typeWords: Record<NavType, string> = {
	movies: "movies",
	shows: "TV shows",
}

// The names people search for, where the label is short or reads awkwardly before "movies".
const genreNouns: Record<string, Partial<Record<NavType, string>>> = {
	animation: { movies: "animated movies", shows: "animated TV shows" },
	documentary: { movies: "documentaries", shows: "documentary series" },
	soap: { shows: "soap operas" },
	talk: { shows: "talk shows" },
	"tv-movie": { movies: "TV movies" },
}

const providerNames: Record<string, string> = {
	netflix: "Netflix",
	"amazon-prime": "Amazon Prime Video",
	"disney-plus": "Disney+",
}

const listNouns: Record<Category, string> = {
	moods: "mood",
	genres: "genre",
	streaming: "streaming service",
}

const capitalize = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1)

/** The label without its emoji, such as "Mind-Bending" for "Mind-Bending 🌀". */
const plainLabel = (label: string) =>
	label
		.replace(/[^\p{L}\p{N}\s&'+-]/gu, "")
		.replace(/\s+/g, " ")
		.trim()

/** A label inside a sentence: lowercase, but an all-caps word such as "TV" stays. */
const inSentence = (label: string) =>
	plainLabel(label)
		.split(" ")
		.map((word) => (/^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()))
		.join(" ")

const itemName = (category: Category, pageData: PageData) =>
	category === "streaming"
		? (providerNames[pageData.path] ?? plainLabel(pageData.label))
		: plainLabel(pageData.label)

const itemsOf = (type: NavType, category: Category) =>
	Object.values<PageData>(mainHierarchy[category]).filter((pageData) =>
		["all", type].includes(pageData.type),
	)

const listNames = (names: string[]) =>
	names.length < 3
		? names.join(" and ")
		: `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`

// The description is shared by the movies and the shows of a list; the sentence after it names the type.
const withDescription = (pageData: PageData, sentence: string) =>
	[pageData.description.replace(/\*/g, ""), sentence].filter(Boolean).join(" ")

/** The copy of one list, such as `/movies/moods/mind-bending`. */
export const explorePageCopy = (
	type: NavType,
	category: Category,
	pageData: PageData,
): PageCopy => {
	const typeWord = typeWords[type]
	if (category === "streaming") {
		const provider = itemName(category, pageData)
		return {
			heading: capitalize(`${typeWord} on ${provider}`),
			intro: withDescription(
				pageData,
				`The most popular ${typeWord} included with ${provider} or free to stream there come first. Open a title to see its ratings and every service that streams it.`,
			),
		}
	}

	const noun =
		category === "genres"
			? (genreNouns[pageData.path]?.[type] ??
				`${inSentence(pageData.label)} ${typeWord}`)
			: `${inSentence(pageData.label)} ${typeWord}`
	return {
		heading: category === "genres" ? `Best ${noun}` : capitalize(noun),
		intro: withDescription(
			pageData,
			`The most popular ${noun} on GoodWatch come first.`,
		),
	}
}

/** The copy of the lists of one category, such as `/movies/moods`. */
export const exploreCategoryCopy = (
	type: NavType,
	category: Category,
): PageCopy => {
	const typeWord = typeWords[type]
	const names = itemsOf(type, category).map((pageData) =>
		itemName(category, pageData),
	)
	const range =
		names.length > 3
			? `${names.length} lists, from ${names[0]} to ${names[names.length - 1]},`
			: `The lists for ${listNames(names)}`
	return {
		heading: `The best ${typeWord} by ${listNouns[category]}`,
		intro: `${mainNavigation[category].description} ${capitalize(range)} each start with the most popular ${typeWord}.`,
	}
}

/** The copy of a type hub, such as `/movies`. */
export const exploreHubCopy = (type: NavType): PageCopy => {
	const typeWord = typeWords[type]
	const count = (category: Category) => itemsOf(type, category).length
	const providers = itemsOf(type, "streaming").map((pageData) =>
		itemName("streaming", pageData),
	)
	return {
		heading: `The best ${typeWord} and where to stream them`,
		intro: `Browse ${count("moods")} moods and ${count("genres")} genres of ${typeWord}, or see what ${listNames(providers)} offer. Each list starts with the most popular ${typeWord}.`,
	}
}
