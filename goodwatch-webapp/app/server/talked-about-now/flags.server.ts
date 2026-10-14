// "Talked about now" (map #537) is gated per surface by one environment variable each, in the style the REC_* flags
// had: set in Coolify and read on every call, so a change needs a container restart but no build. Unset or unknown
// values mean off.
// - off: nobody sees the surface, and its endpoints answer as if there were nothing to show.
// - preview: only the members listed in TALKED_ABOUT_NOW_PREVIEW_USERS (Supabase user ids, separated by commas).
// - on: everyone.
// A page that is on for everyone may be page-cached; in preview an anonymous page has the surface off, and a member's
// page is never cached (docs/cache-identity.md), so a cached page never carries a preview.
/** The environment variables a reader looks at. */
export type Env = Record<string, string | undefined>

export type FeatureMode = "off" | "preview" | "on"

const MODES: readonly FeatureMode[] = ["off", "preview", "on"]

export const SURFACE_VARIABLES = {
	/** The section on title pages (#558). */
	title: "TALKED_ABOUT_NOW_TITLE",
} as const

export type Surface = keyof typeof SURFACE_VARIABLES

const warned = new Set<string>()

export function talkedAboutNowMode(surface: Surface, env: Env = process.env): FeatureMode {
	const name = SURFACE_VARIABLES[surface]
	const raw = (env[name] ?? "").trim().toLowerCase()
	const mode = MODES.find((candidate) => candidate === raw)
	if (mode) return mode
	if (raw && !warned.has(`${name}=${raw}`)) {
		warned.add(`${name}=${raw}`)
		console.warn(`${name}="${raw}" is not off, preview or on. Using off.`)
	}
	return "off"
}

function previewUsers(env: Env): Set<string> {
	return new Set((env.TALKED_ABOUT_NOW_PREVIEW_USERS ?? "").split(/[\s,]+/).filter(Boolean))
}

/** Whether the viewer (a member's user id, or none for a guest) sees the surface. */
export function talkedAboutNowEnabled(
	surface: Surface,
	userId: string | null | undefined,
	env: Env = process.env,
): boolean {
	const mode = talkedAboutNowMode(surface, env)
	if (mode === "on") return true
	if (mode !== "preview") return false
	return Boolean(userId && previewUsers(env).has(userId))
}
