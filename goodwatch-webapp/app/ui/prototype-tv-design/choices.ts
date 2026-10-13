// PROTOTYPE - throwaway. What mini Discover offers on its first screen, with the app's real names.
//
// The real Discover has eleven moods (domain/moods.ts) plus Any mood: too many for one TV screen. Two ways out
// (the key T, `&choice=six`):
//   tabs   three tabs, Moods / Themes / Styles, six options each. The owner's direction. Themes and Styles are the
//          Explorer's islands of those two groupings (server/explorer/islands.server.ts). The real Discover has no
//          filter of either name today; the owner decided it gets both.
//   six    six of the eleven moods, and Any mood beside them. Kept for the comparison.
// Each option says what it is in the real app (`real`): where its titles come from today, and what Discover has
// for it. The page the expand key grows into is always Discover with that one filter. For a theme or a style that
// address is invented (`themes=`, `styles=`, spelled like `moods=`): it does not exist yet.
//
// Names, lines and colours of the moods are read from the real list; the islands' ids, names and colours are
// copied from islands.server.ts (server code, not importable here). The titles are the flow prototype's 25
// samples, so a list is a stand-in: there is one animated title among them and no horror.
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { type Dest, type Title, discover, titleOf } from "~/ui/prototype-tv-flow/data"

export type ChoiceKey = "six" | "tabs"
export const CHOICES: Record<ChoiceKey, string> = { six: "Discover: six moods", tabs: "Discover: three tabs" }

export type TabKey = "moods" | "themes" | "styles"

export type Option = {
	/** The screen of its results is `discover-<id>`. */
	id: string
	/** The focus target on the choice screen. */
	item: string
	name: string
	line: string
	/** "#rrggbb", the real colour of the mood or the island. */
	color: string
	/** A sample title whose picture stands for the option. */
	art: string
	titles: Title[]
	dest: Dest
	/** What it is in the real app: where its titles come from, and what Discover has for it today. */
	real: { titles: string; discover: string }
}

const sample = (...keys: string[]) => keys.map(titleOf)

const mood = (key: MoodKey, art: string, titles: Title[]): Option => {
	const m = MOOD_BY_KEY[key]
	return {
		id: key,
		item: `mood-${key}`,
		name: m.name,
		line: m.description,
		color: m.hue,
		art,
		titles,
		dest: { name: "Discover", href: `/discover?moods=${key}`, carries: `the mood ${m.name}` },
		real: { titles: `Discover's results, /api/discover/results?moods=${key}`, discover: `moods=${key}: the mood itself` },
	}
}

/**
 * An island of the Explorer's Theme or Style grouping, as a choice of Discover. Today its titles can only come from
 * the Explorer, which has the rule. The expand key leads to Discover with the theme or style as a filter: an
 * address that does not exist yet.
 */
const island = (grouping: "theme" | "style", id: string, name: string, line: string, color: string, art: string, titles: Title[], discoverHas: string): Option => ({
	id: `${grouping}.${id}`,
	item: `${grouping}-${id}`,
	name,
	line,
	color,
	art,
	titles,
	dest: { name: "Discover", href: `/discover?${grouping}s=${id}`, carries: `the ${grouping} ${name} (a filter Discover does not have yet)` },
	real: { titles: `the Explorer's island, /api/explorer/island?grouping=${grouping}&id=${id}`, discover: discoverHas },
})

// The six moods of "six": the kinds of evening most people name first, one per well-known genre (comedy, feel-good,
// romance, action, horror, crime). Left out: Mind-bending, Heavy, Other worlds, History, Coming of age, which are
// narrower, and three of which are themes more than moods.
const FUNNY = mood("funny", "the-good-place", discover("funny", null, null))
const FEELGOOD = mood("feelgood", "paddington-2", discover("cozy", null, null))
const ROMANCE = mood("romance", "palm-springs", sample("palm-springs", "groundhog-day", "gilmore-girls", "ted-lasso"))
const ACTION = mood("action", "edge-of-tomorrow", discover("thrilling", null, null))
const SCARY = mood("scary", "severance", sample("severance", "russian-doll", "broadchurch", "arrival"))
const CRIME = mood("crime", "knives-out", sample("knives-out", "only-murders", "oceans-eleven", "slow-horses"))
const MIND = mood("mind", "arrival", discover("mind", null, null))

export const SIX_MOODS: Option[] = [FUNNY, FEELGOOD, ROMANCE, ACTION, SCARY, CRIME]

/** Any mood: the best of everything. */
export const ANY_MOOD: Option = {
	id: "any",
	item: "mood-any",
	name: "Any mood",
	line: "Surprise me.",
	color: "#94a3b8",
	art: "spirited-away",
	titles: discover(null, null, null),
	dest: { name: "Discover", href: "/discover" },
	real: { titles: "Discover's results, /api/discover/results", discover: "no filter" },
}

export const TABS: { key: TabKey; name: string; options: Option[] }[] = [
	// With Crime and Mystery among the themes, the moods tab has Mind-bending where "six" has Crime & mystery.
	{ key: "moods", name: "Moods", options: [FUNNY, FEELGOOD, ROMANCE, ACTION, SCARY, MIND] },
	{
		key: "themes",
		name: "Themes",
		options: [
			island("theme", "crime", "Crime", "Heists, cons and the people who chase them.", "#c2413a", "oceans-eleven", sample("oceans-eleven", "inside-man", "baby-driver", "logan-lucky"), "no filter of this rule; genres=Crime is TMDB's genre, moods=crime is wider"),
			island("theme", "mystery", "Mystery", "A puzzle to solve before the end.", "#5b7fa8", "knives-out", sample("knives-out", "only-murders", "glass-onion", "broadchurch"), "no filter of this rule; genres=Mystery is TMDB's genre, moods=crime is wider"),
			island("theme", "family", "Family", "Parents, siblings and what holds them together.", "#8ccf4d", "the-bear", sample("the-bear", "gilmore-girls", "paddington-2", "knives-out"), "no filter; genres=Family is family-friendly, another thing"),
			island("theme", "growing", "Growing up", "Finding your way, at any age.", "#7cc4e8", "spirited-away", sample("spirited-away", "gilmore-girls", "ted-lasso", "paddington-2"), "moods=growing: the mood Coming of age is the same rule"),
			island("theme", "future", "Future", "Tomorrow's worlds and machines.", "#3fc1b0", "interstellar", sample("interstellar", "the-martian", "edge-of-tomorrow", "andor"), "no filter of this rule; genres=Science Fiction is TMDB's genre, moods=worlds is wider"),
			island("theme", "fantasy", "Fantasy", "Magic, spirits and other rules.", "#d4508a", "the-good-place", sample("spirited-away", "the-good-place", "russian-doll", "groundhog-day"), "no filter of this rule; genres=Fantasy is TMDB's genre, moods=worlds is wider"),
		],
	},
	{
		key: "styles",
		name: "Styles",
		options: [
			island("style", "animated", "Animated", "Drawn, painted or rendered.", "#e38fb8", "spirited-away", sample("spirited-away", "paddington-2"), "genres=Animation: the island's own rule"),
			island("style", "spectacle", "Spectacle", "Made for the biggest screen.", "#e8793d", "interstellar", sample("interstellar", "edge-of-tomorrow", "andor", "the-martian"), "no filter; moods=action also asks for adrenaline"),
			island("style", "slow", "Slow burn", "Takes its time, pays it back.", "#5b7fa8", "slow-horses", sample("severance", "slow-horses", "broadchurch", "arrival"), "no filter"),
			island("style", "fast", "Fast-paced", "No scene wasted.", "#c2413a", "baby-driver", sample("baby-driver", "edge-of-tomorrow", "the-bear", "oceans-eleven"), "no filter"),
			island("style", "talky", "Talky", "The dialogue is the action.", "#b98a5a", "gilmore-girls", sample("gilmore-girls", "the-office", "knives-out", "only-murders"), "no filter"),
			island("style", "nonlinear", "Nonlinear", "Time loops, folds and jumps.", "#8e62d6", "russian-doll", sample("russian-doll", "palm-springs", "groundhog-day", "arrival"), "no filter; moods=mind is wider"),
		],
	},
]

const ALL = [...SIX_MOODS, ANY_MOOD, MIND, ...TABS.flatMap((t) => t.options)]
/** The option a results screen (`discover-<id>`) belongs to. */
export const optionOf = (id: string): Option | null => ALL.find((o) => o.id === id) ?? null
/** The tab an option stands in. */
export const tabOf = (id: string): TabKey => (id.startsWith("theme.") ? "themes" : id.startsWith("style.") ? "styles" : "moods")

// ---------------------------------------------------------------------------------------------------------
// The streaming services the Remote has keys for. The ids are TMDB's provider ids, as the real Remote's
// (living-room-data.ts REMOTE_SERVICES) and as the real Discover's `services` parameter takes them.

export type ServiceKey = "netflix" | "prime"
export const SERVICES: Record<ServiceKey, { key: ServiceKey; id: number; name: string; accent: string; ink: string }> = {
	netflix: { key: "netflix", id: 8, name: "Netflix", accent: "#e50914", ink: "#e50914" },
	prime: { key: "prime", id: 9, name: "Prime Video", accent: "#1a98ff", ink: "#ffffff" },
}
export const serviceOfName = (name: string): ServiceKey | null => (Object.values(SERVICES).find((s) => s.name === name)?.key ?? null)
/** The real page that lists what streams on a service: Discover with that one service. */
export const serviceDest = (key: ServiceKey): Dest => ({ name: "Discover", href: `/discover?services=${SERVICES[key].id}`, carries: `only ${SERVICES[key].name}` })
