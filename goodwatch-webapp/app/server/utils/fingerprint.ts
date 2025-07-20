import type {
	CoreScores,
	MediaDNA,
	GenreBlend,
	Highlight,
	DoubleFeature,
} from "./mediaDNA"
import {
	GENRE_BLEND_LIBRARY,
	HIGHLIGHT_LIBRARY,
	DOUBLE_FEATURE_LIBRARY,
} from "./mediaDNALibraries"

// --- VIEWING GUIDE DEFINITIONS ---

export interface SocialSuitability {
	id: string
	name: string
	description: string
	score: number
}

export interface ViewingContext {
	id: string
	name: string
	description: string
	score: number
}

const SOCIAL_SUITABILITY_REGISTRY: Record<
	string,
	{ name: string; description: string }
> = {
	adults: { name: "Adults", description: "Mature themes, not for kids." },
	date_night: {
		name: "Date Night",
		description: "Great for a romantic evening.",
	},
	family: {
		name: "Family Movie Night",
		description: "Perfect for watching with the whole family.",
	},
	friends: {
		name: "Friends Night",
		description: "A fun watch with a group of friends.",
	},
	group_party: {
		name: "Party Vibe",
		description: "Lively and great for a group setting.",
	},
	intergenerational: {
		name: "Intergenerational",
		description: "Enjoyable for a wide range of ages.",
	},
	kids: { name: "Kids", description: "Made for children." },
	partner: {
		name: "Partner Watch",
		description: "Good to watch with a significant other.",
	},
	public_viewing_safe: {
		name: "Public Viewing Safe",
		description: "No awkward scenes when watching in public.",
	},
	solo_watch: { name: "Solo Watch", description: "Best enjoyed by yourself." },
	teens: { name: "Teens", description: "Aimed at a teenage audience." },
}

const VIEWING_CONTEXT_REGISTRY: Record<
	string,
	{ name: string; description: string }
> = {
	background_friendly: {
		name: "Background Watch",
		description: "Doesn't require your full attention.",
	},
	binge_friendly: {
		name: "Binge-Friendly",
		description: "You'll want to watch episode after episode.",
	},
	comfort_watch: {
		name: "Comfort Watch",
		description: "Cozy, familiar, and reassuring.",
	},
	drop_in_friendly: {
		name: "Drop-in Friendly",
		description: "Easy to follow along even if you miss a bit.",
	},
	pure_escapism: {
		name: "Pure Escapism",
		description: "Lets you completely disconnect from reality.",
	},
	thought_provoking: {
		name: "Thought-Provoking",
		description: "Will leave you with a lot to think about.",
	},
}

// --- HELPER FUNCTIONS ---

function calculateAverageScore(
	scores: CoreScores,
	keys: (keyof CoreScores)[],
): number {
	if (keys.length === 0) return 0
	const total = keys.reduce((acc, key) => acc + scores[key], 0)
	return total / keys.length
}

// --- VIEWING GUIDE BUILDERS ---

function getSocialSuitability(dnaAnalysis: DNAAnalysis): SocialSuitability[] {
	const matched: SocialSuitability[] = []
	for (const id in SOCIAL_SUITABILITY_REGISTRY) {
		const key = `suitability_${id}` as keyof DNAAnalysis
		const value = dnaAnalysis[key] as boolean
		if (value) {
			const rule = SOCIAL_SUITABILITY_REGISTRY[id]
			matched.push({
				id,
				name: rule.name,
				description: rule.description,
				score: 10,
			})
		}
	}
	return matched
}

function getViewingContext(dnaAnalysis: DNAAnalysis): ViewingContext[] {
	const matched: ViewingContext[] = []
	for (const id in VIEWING_CONTEXT_REGISTRY) {
		const key = `context_is_${id}` as keyof DNAAnalysis
		const value = dnaAnalysis[key] as boolean
		if (value) {
			const rule = VIEWING_CONTEXT_REGISTRY[id]
			matched.push({
				id,
				name: rule.name,
				description: rule.description,
				score: 10,
			})
		}
	}
	return matched
}

// --- MAIN FINGERPRINT BUILDER ---

function buildMediaDNA(scores: CoreScores): MediaDNA {
	const matchedGenreBlends: GenreBlend[] = GENRE_BLEND_LIBRARY.filter((rule) =>
		rule.condition(scores),
	)
		.map((rule) => ({
			id: rule.id,
			name: rule.name,
			description: rule.description,
			score: calculateAverageScore(scores, rule.matchedScoreKeys),
		}))
		.sort((a, b) => b.score - a.score)

	const matchedHighlights: Highlight[] = HIGHLIGHT_LIBRARY.filter((rule) => {
		const hasRequiredBlend =
			!rule.requiredGenreBlends ||
			rule.requiredGenreBlends.some((blendId) =>
				matchedGenreBlends.some((b) => b.id === blendId),
			)
		return hasRequiredBlend && rule.condition(scores)
	})
		.map((rule) => ({
			id: rule.id,
			name: rule.name,
			icon: rule.icon,
			description: rule.description,
			score: calculateAverageScore(scores, rule.matchedScoreKeys),
		}))
		.sort((a, b) => b.score - a.score)

	const matchedDoubleFeatures: DoubleFeature[] = DOUBLE_FEATURE_LIBRARY.filter(
		(rule) => rule.condition(matchedGenreBlends, matchedHighlights),
	)
		.map((rule) => ({
			id: rule.id,
			name: rule.name,
			description: rule.description,
			icon: rule.icon,
			score: rule.getScore(matchedGenreBlends, matchedHighlights),
		}))
		.sort((a, b) => b.score - a.score)

	return {
		genreBlends: matchedGenreBlends.slice(0, 4),
		highlights: matchedHighlights.slice(0, 8),
		doubleFeatures: matchedDoubleFeatures.slice(0, 2),
	}
}

// --- FINGERPRINT RESULT BUILDER ---

export interface DNAAnalysis {
	scores: CoreScores
	genres: string[]
	essenceTags: string[]
	essenceText: string
	content_advisories: any
	context_is_background_friendly: boolean
	context_is_binge_friendly: boolean
	context_is_comfort_watch: boolean
	context_is_drop_in_friendly: boolean
	context_is_pure_escapism: boolean
	context_is_thought_provoking: boolean
	suitability_adults: boolean
	suitability_date_night: boolean
	suitability_family: boolean
	suitability_friends: boolean
	suitability_group_party: boolean
	suitability_intergenerational: boolean
	suitability_kids: boolean
	suitability_partner: boolean
	suitability_public_viewing_safe: boolean
	suitability_solo_watch: boolean
	suitability_teens: boolean
}

export interface Overview {
	title: string
	body: string
}

export interface Tag {
	name: string
	score: number
}

export interface FingerprintResult {
	scores: CoreScores
	mediaDNA: MediaDNA
	overview: Overview
	tags: Tag[]
	socialSuitability: SocialSuitability[]
	viewingContext: ViewingContext[]
}

function getOverview(mediaDNA: MediaDNA, essenceText?: string): Overview {
	const topBlend = mediaDNA.genreBlends[0]
	const topHighlight = mediaDNA.highlights[0]

	if (!topBlend || !topHighlight) {
		return {
			title: "A Unique Cinematic Experience",
			body:
				essenceText ||
				"This title has a distinctive mix of qualities that make it stand out.",
		}
	}

	const title = `A ${topBlend.name} with a Focus on ${topHighlight.name}`
	const body =
		essenceText ||
		`This title masterfully blends the elements of a ${topBlend.name.toLowerCase()} with a strong emphasis on ${topHighlight.name.toLowerCase()}. ${topHighlight.description}`

	return { title, body }
}

export function buildFingerprint(dnaAnalysis: DNAAnalysis): FingerprintResult {
	const { scores, essenceText, essenceTags } = dnaAnalysis
	const mediaDNA = buildMediaDNA(scores)
	const overview = getOverview(mediaDNA, essenceText)
	const tags = essenceTags
	const socialSuitability = getSocialSuitability(dnaAnalysis)
	const viewingContext = getViewingContext(dnaAnalysis)

	return {
		scores,
		mediaDNA,
		overview,
		tags,
		socialSuitability,
		viewingContext,
	}
}
