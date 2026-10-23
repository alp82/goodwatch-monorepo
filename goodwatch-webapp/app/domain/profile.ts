// The member profile at /u/:handle: who may see which part, the member's profile settings, and the view models the
// profile's loaders return. Types and pure rules only, so browser code can import them.
// Spec: docs/implementation/member-profile/README.md

// ---------- Visibility ----------

export const PROFILE_PARTS = [
	"scores",
	"seen",
	"wishlist",
	"shows",
	"lists",
	"taste",
	"hours",
	"activity",
] as const
export type ProfilePart = (typeof PROFILE_PARTS)[number]

export const AUDIENCES = ["everyone", "members", "me"] as const
export type Audience = (typeof AUDIENCES)[number]

export type ProfileVisibility = Record<ProfilePart, Audience>

/** Everything is public until the member narrows it (owner decision, 2026-10-23). */
export const DEFAULT_VISIBILITY: ProfileVisibility = {
	scores: "everyone",
	seen: "everyone",
	wishlist: "everyone",
	shows: "everyone",
	lists: "everyone",
	taste: "everyone",
	hours: "everyone",
	activity: "everyone",
}

/** Who is looking at a profile. */
export type ProfileViewer = "owner" | "member" | "guest"

export function canSee(
	visibility: ProfileVisibility,
	part: ProfilePart,
	viewer: ProfileViewer,
) {
	if (viewer === "owner") return true
	const audience = visibility[part]
	return viewer === "member" ? audience !== "me" : audience === "everyone"
}

/** Whether the profile's viewer may see a part. */
export const seesPart = (
	shell: Pick<ProfileShell, "visibility" | "viewer">,
	part: ProfilePart,
) => canSee(shell.visibility, part, shell.viewer)

/**
 * Profiles went public with the release deployed on October 23, 2026 (owner decision Q1). Members whose handle predates it get the
 * "GoodWatch has profiles now" strip (Q16); members who claim a handle later chose a public profile knowingly.
 */
export const PROFILE_PUBLIC_SINCE = "2026-10-23T02:30:00Z"

/**
 * Whether a member still gets the "GoodWatch has profiles now" strip: their handle predates the release and they
 * haven't confirmed Who sees what (any save of Edit profile counts).
 */
export const owesProfilesStrip = (
	claimedAt: string | null,
	noticeSeen: boolean,
) => claimedAt != null && claimedAt < PROFILE_PUBLIC_SINCE && !noticeSeen

/** Where the strip leads: Edit profile, scrolled to Who sees what, with its Confirm button. */
export const CONFIRM_VISIBILITY_PATH = "/settings/profile?confirm=1"

/** Reads a stored visibility value, keeping only known parts and audiences. */
export function parseVisibility(value: unknown): ProfileVisibility {
	const out = { ...DEFAULT_VISIBILITY }
	if (value && typeof value === "object")
		for (const part of PROFILE_PARTS) {
			const audience = (value as Record<string, unknown>)[part]
			if (AUDIENCES.includes(audience as Audience))
				out[part] = audience as Audience
		}
	return out
}

// ---------- Profile settings (user_setting keys) ----------

export const LINK_SERVICES = [
	"letterboxd",
	"imdb",
	"myanimelist",
	"trakt",
	"tmdb",
	"tvtime",
	"simkl",
	"anilist",
	"serializd",
	"instagram",
	"website",
] as const
export type LinkService = (typeof LINK_SERVICES)[number]
export const MAX_LINKS = 6
export const BIO_MAX = 160

export interface ProfileLink {
	service: LinkService
	/** A username, or a domain for "website". */
	value: string
}

export const AVATAR_COLORS = [
	"amber",
	"rose",
	"violet",
	"sky",
	"emerald",
	"slate",
] as const
export type AvatarColor = (typeof AVATAR_COLORS)[number]

/** The picture: an uploaded photo, the sign-in provider's photo, the handle's initial on a colour, or a favorite's
 * poster (a title the member scored). */
export type AvatarChoice =
	| { kind: "photo" }
	| { kind: "provider" }
	| { kind: "initial"; color: AvatarColor }
	| { kind: "poster"; title: string }

export interface ProfileSettings {
	bio: string
	links: ProfileLink[]
	avatar: AvatarChoice
	/** A title key (e.g. "movie-550") whose backdrop sits behind the header; null for none. */
	cover: string | null
	visibility: ProfileVisibility
}

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
	bio: "",
	links: [],
	avatar: { kind: "initial", color: "amber" },
	cover: null,
	visibility: DEFAULT_VISIBILITY,
}

// ---------- View models ----------

/** A title as the profile shows it. `key` is "movie-550" / "show-1396". Image paths are TMDB paths ("/abc.jpg"). */
export interface ProfileTitle {
	key: string
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	year: number | null
	poster: string | null
	backdrop: string | null
	href: string
	/** The profile owner's score, 1 to 10. */
	score: number | null
	/** GoodWatch score, 0 to 100. */
	gw: number | null
	/** ISO date: last watched (Seen, Scores, activity) or added (Wishlist). */
	date: string | null
}

/** Everything every profile page needs: who, what they share, who is looking. */
export interface ProfileShell {
	handle: string
	viewer: ProfileViewer
	/** The visibility as the owner set it; parts the viewer may not see are hidden by the pages. */
	visibility: ProfileVisibility
	/** Resolved picture: an image URL (photo, provider photo, or poster), else the initial on a colour. */
	avatar: { url: string | null; color: AvatarColor }
	cover: { backdrop: string; title: string } | null
	bio: string
	links: ProfileLink[]
	/** "2019-03" from the earliest rating or watch; null when the library is empty. */
	since: string | null
	counts: {
		seen: number
		seenMovies: number
		rated: number
		wishlist: number
		lists: number
		/** Hours watched, rounded; real runtimes where known. */
		hours: number
		episodes: number
		average: number | null
	}
	/** Count per score 1..10. */
	spread: number[]
	/** Whether the page may be indexed (20+ public scores). */
	indexable: boolean
}

export interface ProfileOverview {
	/** Every 10, latest watched first. Empty when scores are hidden from the viewer. */
	favorites: ProfileTitle[]
	recent: ProfileTitle[]
	watching: (ProfileTitle & {
		watchedEpisodes: number
		airedEpisodes: number | null
		next: string | null
	})[]
	newestWishlist: ProfileTitle[]
	lists: ProfileListCard[]
	/** Where the owner parts most with the GoodWatch score (points out of 10, positive = owner higher). */
	hotTakes: { title: ProfileTitle; delta: number }[]
}

export interface ProfileListCard {
	id: string
	title: string
	href: string
	/** Full poster URLs (w500), as share-list cards carry them. */
	posters: (string | null)[]
}

/** The Lists tab: the owner sees every list with its visibility; everyone else sees public lists. */
export interface ProfileListsPage {
	lists: import("~/ui/share-lists/ShareListTile").ShareListSummary[]
}

/** At most this many titles per score on the Scores tab; `total` says how many there are. */
export const SCORES_TIER_MAX = 120
/** At most this many titles on the Seen tab (the latest watches); `total` says how many there are. */
export const SEEN_MAX = 400

export interface ProfileScoresPage {
	/** Each tier's latest titles, at most SCORES_TIER_MAX, with how many the tier holds. */
	tiers: { score: number; titles: ProfileTitle[]; total: number }[]
}

export interface ProfileSeenPage {
	/** Latest watch first, titles without a date at the end; at most SEEN_MAX. */
	titles: ProfileTitle[]
	total: number
}

export interface ProfileWishlistPage {
	/** Owner only: wishlist titles on their services, best match first. */
	watchNow: (ProfileTitle & { match: number | null })[] | null
	titles: ProfileTitle[]
	total: number
}

export type ShowGroup =
	| "continue"
	| "pickUp"
	| "waiting"
	| "start"
	| "onHold"
	| "dropped"
export interface ProfileShowsPage {
	groups: {
		group: ShowGroup
		shows: (ProfileTitle & {
			watchedEpisodes: number
			airedEpisodes: number | null
			next: string | null
		})[]
	}[]
}
