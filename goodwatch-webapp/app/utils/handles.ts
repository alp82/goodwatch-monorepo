// Handle rules for public profiles, shared by the server (which enforces them) and the settings form (which explains
// them while someone types).

export const HANDLE_MIN = 3
export const HANDLE_MAX = 30
const HANDLE = /^[a-z][a-z0-9_]*$/
// Route names, brand words, and roles people could use to impersonate the site.
const RESERVED_HANDLES = new Set([
	"about",
	"account",
	"admin",
	"administrator",
	"api",
	"app",
	"auth",
	"discover",
	"disclaimer",
	"explore",
	"forgot_password",
	"goodwatch",
	"good_watch",
	"help",
	"how_it_works",
	"landing",
	"list",
	"lists",
	"login",
	"logout",
	"me",
	"moderator",
	"movie",
	"movies",
	"new",
	"og",
	"person",
	"privacy",
	"profile",
	"prototype",
	"reset_password",
	"root",
	"search",
	"settings",
	"share",
	"show",
	"shows",
	"sign_in",
	"sign_up",
	"signin",
	"signup",
	"staff",
	"support",
	"system",
	"taste",
	"tv",
	"u",
	"user",
	"users",
	"wishlist",
])

// A handle renamed away from, or of a deleted account, stays on hold this long before anyone else can claim it.
// During the hold, the person who renamed away can switch back, and their old profile URL redirects.
export const HANDLE_HOLD_DAYS = 90

export const normalizeHandle = (handle: unknown) =>
	typeof handle === "string"
		? handle.trim().replace(/^@/, "").toLowerCase()
		: ""

/** Null when the handle is valid, otherwise why not. */
export function handleProblem(handle: string): string | null {
	if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX)
		return `Handles have ${HANDLE_MIN} to ${HANDLE_MAX} characters.`
	if (!HANDLE.test(handle))
		return "Use lowercase letters, digits, and underscores, starting with a letter."
	if (RESERVED_HANDLES.has(handle)) return "That handle is reserved."
	return null
}

/**
 * Turns free text, such as a signature or the name part of an email address, into a valid handle, or null when
 * nothing usable is left. Used to suggest a handle; people can always type their own.
 */
export function handleFromText(text: string | null | undefined): string | null {
	if (!text) return null
	const handle = text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^[^a-z]+/, "")
		.replace(/_+/g, "_")
		.slice(0, HANDLE_MAX)
		.replace(/_+$/, "")
	return handleProblem(handle) ? null : handle
}
