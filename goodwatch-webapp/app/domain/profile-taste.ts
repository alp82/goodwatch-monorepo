// The profile's Taste tab beyond the taste portrait (stats), and the comparison between a signed-in visitor and the
// profile's owner (match, overlap, splits, picks). Types and pure helpers only, so browser code can import them.
// The portrait itself (viewer type, fingerprint, sides, crowd) is server/taste-portrait/view.ts.
import type { ProfileTitle } from "./profile"

// ---------- Stats ----------

/** Titles in a decade's panel on the Stats tab. */
export const DECADE_TITLES = 14

export interface TastePerson {
	id: number
	name: string
	/** TMDB profile path. */
	profile: string | null
	count: number
	/** Null when the viewer may not see the owner's scores. */
	average: number | null
	/** Null when the viewer may not see the owner's time watched. */
	hours: number | null
	titles: ProfileTitle[]
}

/**
 * The Taste tab's numbers as the viewer may see them (server/profile/taste-stats-view.ts): without the owner's scores
 * every average is null, `style` is null and titles carry no score; without Seen, `facts` is null; without Shows or
 * time watched, `facts.mostEpisodes` is null.
 */
/** An essence tag and how many of the titles scored 8 or more carry it, for the Taste page's cloud. */
export interface TasteTag {
	name: string
	count: number
}

export interface TasteStats {
	genres: {
		name: string
		count: number
		average: number | null
		kinds: Partial<Record<"movie" | "show" | "anime", number>>
	}[]
	people: {
		directors: TastePerson[]
		bestDirectors: TastePerson[]
		actors: TastePerson[]
		composers: TastePerson[]
		writers: TastePerson[]
	}
	eras: {
		decades: {
			decade: number
			count: number
			average: number | null
			/** The decade's rated titles for its panel, best rated first; by GoodWatch score when scores are hidden. */
			titles: ProfileTitle[]
			/** The same titles by GoodWatch score, kept for viewers without the owner's scores; statsForViewer empties it. */
			byCrowd: ProfileTitle[]
		}[]
		averageYear: number | null
		classics: ProfileTitle[]
	}
	world: {
		countries: {
			code: string
			count: number
			share: number
			average: number | null
		}[]
		totalCountries: number
		languages: { code: string; count: number }[]
		totalLanguages: number
	}
	tags: {
		essence: { name: string; count: number; average: number | null }[]
		tropes: { name: string; count: number }[]
	}
	facts: {
		budget: number
		revenue: number
		/** `minutes`: the runtime (optional, asked for by the Taste tab). */
		longest: (ProfileTitle & { minutes?: number }) | null
		shortest: (ProfileTitle & { minutes?: number }) | null
		oldest: ProfileTitle | null
		newest: ProfileTitle | null
		mostEpisodes: (ProfileTitle & { episodes: number }) | null
		averageRuntime: number | null
	} | null
	style: {
		average: number
		crowdAverage: number
		/** Mean of (score - GoodWatch score / 10). */
		offset: number
		label: "Generous" | "Balanced" | "Tough"
		share8: number
		byKind: Partial<Record<"movie" | "show" | "anime", number>>
		kindest: { genre: string; average: number } | null
		harshest: { genre: string; average: number } | null
	} | null
	badges: { id: string; name: string; line: string }[]
}

// ---------- Member match ----------

export type MatchTier =
	| "Taste twins"
	| "Like-minded"
	| "Common ground"
	| "Some overlap"
	| "Different worlds"

export function matchTier(percent: number): MatchTier {
	if (percent >= 90) return "Taste twins"
	if (percent >= 75) return "Like-minded"
	if (percent >= 60) return "Common ground"
	if (percent >= 45) return "Some overlap"
	return "Different worlds"
}

/** The comparison between the signed-in visitor ("you") and the profile owner ("them"). */
export type MemberCompare =
	/** One side has fewer than 5 liked titles: "you" the visitor (checked first) or "them" the owner, with its count. */
	| { status: "thin"; side: "you" | "them"; liked: number }
	| {
			status: "ready"
			/** 1 to 99, ranked against a sample of member pairs. */
			percent: number
			/** Labels of worded attributes: pulling both, only them, only you (strongest first). */
			pulls: { both: string[]; onlyThem: string[]; onlyYou: string[] }
			/** Titles both rated: your score and theirs, widest gap first. */
			shared: (ProfileTitle & { yours: number; theirs: number })[]
			overlap: {
				/** Both scored 8 or more. */
				both: ProfileTitle[]
				bothCount: number
				/** Their 9s and 10s you haven't rated, best fit for your pulls first, with the pull. */
				onlyThem: (ProfileTitle & { why: string | null })[]
				onlyThemCount: number
				/** Your 8s and up they haven't rated; `wished` when on their wishlist. */
				onlyYou: (ProfileTitle & { yours: number; wished: boolean })[]
				onlyYouCount: number
			}
			/** Your edge per fingerprint key, on the owner's portrait scale, for Vs me. */
			yourEdges: Record<string, { edge: number; tier: number }>
			/** Your viewer type ("Slow burns, wit, history"), or null. */
			yourIdentity: string | null
			yourUsual: number | null
			/** Your scores by title key, for the "You" tags. */
			yourScores: Record<string, number>
	  }
