export interface Feature {
	id: string
	level: number
	icon: string
	shortName: string
	name: string
	shortDescription: string
	fullDescription: string
	unlockAt: number
	requirements: string[]
	comingSoon?: boolean
}

// Guest user limits
export const GUEST_LIMITS = {
	FIRST_UNLOCK: 5, // 5 ratings to unlock first recommendations
	HARD_CAP: 20, // Maximum ratings for guests before sign-up required
} as const

export function isGuestLimitReached(ratingsCount: number): boolean {
	return ratingsCount >= GUEST_LIMITS.HARD_CAP
}

export interface FeatureStats {
	featureId: string
	stats: {
		label: string
		value: string | number
	}[]
}

export const FEATURES: Feature[] = [
	{
		id: "recommendations",
		level: 1,
		icon: "✨",
		shortName: "Picks",
		name: "Recommendations",
		shortDescription: "Your first personalized picks",
		fullDescription:
			"Your first personalized picks. Accuracy is low but gets better fast.",
		unlockAt: 5,
		requirements: ["Rate 5 items"],
	},
	{
		id: "fingerprint_preview",
		level: 2,
		icon: "🧬",
		shortName: "Preview",
		name: "Fingerprint Preview",
		shortDescription: "Understanding your taste",
		fullDescription:
			"See your top 3 taste traits and get recommendations filtered by what makes your taste unique.",
		unlockAt: 15,
		requirements: ["Rate 15 items total"],
	},
	// Features beyond guest cap - only shown to signed-in users
	{
		id: "genre_detection",
		level: 3,
		icon: "🎨",
		shortName: "Genres",
		name: "Genre Detection",
		shortDescription: "Your favorite genres",
		fullDescription:
			"Discover which genres you love most. See patterns like 'You love Action & Horror movies'.",
		unlockAt: 30,
		requirements: ["Rate 30 total items"],
	},
	{
		id: "decade_detection",
		level: 4,
		icon: "🗓️",
		shortName: "Decades",
		name: "Decade Detection",
		shortDescription: "Your era preferences",
		fullDescription:
			"Find out which decades resonate with you. See insights like 'You prefer movies from the 2000s and 2010s'.",
		unlockAt: 50,
		requirements: ["Rate 50 total items"],
	},
	{
		id: "creator_detection",
		level: 5,
		icon: "📖",
		shortName: "Cast",
		name: "Director & Actor Detection",
		shortDescription: "Your favorite creators",
		fullDescription:
			"Discover your favorite directors and actors. See stats like 'You've watched 4/5 Christopher Nolan movies'.",
		unlockAt: 75,
		requirements: ["Rate 75 total items"],
	},
	{
		id: "fingerprint_detection",
		level: 6,
		icon: "🧬",
		shortName: "Fingerprint",
		name: "Full Fingerprint",
		shortDescription: "Your unique taste DNA",
		fullDescription:
			"Unlock your complete taste fingerprint. See deep insights like 'You prefer high adrenaline, low complexity content'.",
		unlockAt: 100,
		requirements: ["Rate 100 total items"],
	},
	{
		id: "neighbor_finding",
		level: 7,
		icon: "👥",
		shortName: "Neighbors",
		name: "Find Neighbors",
		shortDescription: "Connect with similar users",
		fullDescription:
			"Find other users with similar taste. Discover what your taste neighbors are watching.",
		unlockAt: 200,
		requirements: ["Rate 200 total items"],
		comingSoon: true,
	},
]

export interface LevelInfo {
	level: number
	icon: string
	minRatings: number
	maxRatings: number
}

export interface LevelMeta {
	name: string
	description: string
}

export const LEVEL_META: Record<number, LevelMeta> = {
	1: { name: "First Taste", description: "Just getting started" },
	2: { name: "Warming Up", description: "Building your profile" },
	3: { name: "On Point", description: "Recommendations are dialed in" },
}

export const LEVELS: LevelInfo[] = [
	{ level: 1, icon: "🌱", minRatings: 0, maxRatings: 2 },
	{ level: 2, icon: "🔥", minRatings: 3, maxRatings: 9 },
	{ level: 3, icon: "🎯", minRatings: 10, maxRatings: 39 },
	{ level: 4, icon: "🎨", minRatings: 40, maxRatings: 59 },
	{ level: 5, icon: "📅", minRatings: 60, maxRatings: 79 },
	{ level: 6, icon: "🎬", minRatings: 80, maxRatings: 99 },
	{ level: 7, icon: "🧬", minRatings: 100, maxRatings: 149 },
	{ level: 8, icon: "👥", minRatings: 150, maxRatings: 199 },
	{ level: 9, icon: "🌟", minRatings: 200, maxRatings: 299 },
	{ level: 10, icon: "🎭", minRatings: 300, maxRatings: 499 },
	{ level: 11, icon: "🍷", minRatings: 500, maxRatings: 749 },
	{ level: 12, icon: "📝", minRatings: 750, maxRatings: 999 },
	{ level: 13, icon: "🎪", minRatings: 1000, maxRatings: 1499 },
	{ level: 14, icon: "🔥", minRatings: 1500, maxRatings: 1999 },
	{ level: 15, icon: "🎯", minRatings: 2000, maxRatings: 2999 },
	{ level: 16, icon: "🎼", minRatings: 3000, maxRatings: 3999 },
	{ level: 17, icon: "🧠", minRatings: 4000, maxRatings: 4999 },
	{ level: 18, icon: "🎨", minRatings: 5000, maxRatings: 6999 },
	{ level: 19, icon: "⭐", minRatings: 7000, maxRatings: 8999 },
	{ level: 20, icon: "🔮", minRatings: 9000, maxRatings: 10000 },
]

export function getCurrentLevel(ratingsCount: number): LevelInfo {
	for (let i = LEVELS.length - 1; i >= 0; i--) {
		if (ratingsCount >= LEVELS[i].minRatings) {
			return LEVELS[i]
		}
	}
	return LEVELS[0]
}

export function getNextLevel(currentLevel: number): LevelInfo | null {
	return LEVELS.find((l) => l.level === currentLevel + 1) || null
}

export function getUnlockedFeatures(ratingsCount: number): Feature[] {
	return FEATURES.filter((f) => ratingsCount >= f.unlockAt)
}

export function getLockedFeatures(ratingsCount: number): Feature[] {
	return FEATURES.filter((f) => ratingsCount < f.unlockAt)
}

export function getNextUnlockableFeature(
	ratingsCount: number,
): Feature | null {
	const locked = getLockedFeatures(ratingsCount)
	return locked.length > 0 ? locked[0] : null
}

export function getFeatureProgress(
	feature: Feature,
	ratingsCount: number,
): number {
	if (ratingsCount >= feature.unlockAt) return 100
	return Math.floor((ratingsCount / feature.unlockAt) * 100)
}

export function getFeatureLevelNumber(ratingsCount: number): number {
	const unlocked = getUnlockedFeatures(ratingsCount)
	// Level 1 = pre-unlock, Level 2 = first recs, Level 3 = warming up, etc.
	return unlocked.length
}

export function getNextFeatureLevelNumber(ratingsCount: number): number {
	return getFeatureLevelNumber(ratingsCount) + 1
}

// TODO: Implement stats tracking for features
// Track things like:
// - Number of recommendations shown
// - Match accuracy percentage
// - Top genres/decades/creators discovered
// - Number of neighbors found
// - Taste clusters identified
