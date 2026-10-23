// The profile's Taste tab beyond the taste portrait (stats), and the comparison between a signed-in visitor and the
// profile's owner (match, overlap, splits, picks). Types and pure helpers only, so browser code can import them.
// The portrait itself (viewer type, fingerprint, sides, crowd) is server/taste-portrait/view.ts.
import type { ProfileTitle } from "./profile"

// ---------- Stats ----------

export interface TastePerson {
	id: number
	name: string
	/** TMDB profile path. */
	profile: string | null
	count: number
	average: number
	hours: number
	titles: ProfileTitle[]
}

export interface TasteStats {
	genres: { name: string; count: number; average: number; kinds: Partial<Record<"movie" | "show" | "anime", number>> }[]
	people: {
		directors: TastePerson[]
		bestDirectors: TastePerson[]
		actors: TastePerson[]
		composers: TastePerson[]
		writers: TastePerson[]
	}
	eras: { decades: { decade: number; count: number; average: number }[]; averageYear: number | null; classics: ProfileTitle[] }
	world: {
		countries: { code: string; count: number; share: number; average: number }[]
		totalCountries: number
		languages: { code: string; count: number }[]
		totalLanguages: number
	}
	tags: { essence: { name: string; count: number; average: number }[]; tropes: { name: string; count: number }[] }
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
	}
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
	}
	badges: { id: string; name: string; line: string }[]
}

// ---------- Member match ----------

export type MatchTier = "Taste twins" | "Like-minded" | "Common ground" | "Some overlap" | "Different worlds"

export function matchTier(percent: number): MatchTier {
	if (percent >= 90) return "Taste twins"
	if (percent >= 75) return "Like-minded"
	if (percent >= 60) return "Common ground"
	if (percent >= 45) return "Some overlap"
	return "Different worlds"
}

/** The comparison between the signed-in visitor ("you") and the profile owner ("them"). */
export type MemberCompare =
	| { status: "thin"; liked: number } // the visitor has fewer than 5 liked titles
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
			/** Your viewer type name ("The slow-burn fan"), or null. */
			yourIdentity: string | null
			yourUsual: number | null
			/** Your scores by title key, for the "You" tags. */
			yourScores: Record<string, number>
	  }
