// One environment variable per feature, set in Coolify and read on every call,
// so a change needs a container restart but no build. Unset or unknown values
// mean off, and the page serves without the feature.
// - off: the feature is hidden for everyone.
// - preview: only the members listed in REC_PREVIEW_USERS see it.
// - on: everyone sees it.
export type FeatureMode = "off" | "preview" | "on"

const MODES: readonly FeatureMode[] = ["off", "preview", "on"]

const FEATURE_VARIABLES = {
	// The "Talked about now" row below the start page's room (#557).
	talkedAboutNow: "REC_TALKED_ABOUT_NOW",
} as const

export type Feature = keyof typeof FEATURE_VARIABLES

// Compatible with both a member ({ userId }) and a guest (no userId).
export type FeatureViewer = { userId?: string | null } | null | undefined

const warnedValues = new Set<string>()

export function getFeatureMode(feature: Feature): FeatureMode {
	const name = FEATURE_VARIABLES[feature]
	const raw = (process.env[name] ?? "").trim().toLowerCase()
	const mode = MODES.find((candidate) => candidate === raw)
	if (mode) return mode
	const warning = `${name}=${raw}`
	if (raw && !warnedValues.has(warning)) {
		warnedValues.add(warning)
		console.warn(`${name}="${raw}" is not off, preview or on. Using off.`)
	}
	return "off"
}

function getPreviewUserIds(): Set<string> {
	return new Set(
		(process.env.REC_PREVIEW_USERS ?? "")
			.split(/[\s,]+/)
			.filter((userId) => userId),
	)
}

// Whether the viewer sees the feature.
export function isEnabled(feature: Feature, viewer: FeatureViewer): boolean {
	const mode = getFeatureMode(feature)
	if (mode === "on") return true
	if (mode !== "preview") return false
	const userId = viewer?.userId
	return Boolean(userId && getPreviewUserIds().has(userId))
}

// For a loader that doesn't have the user yet. A guest never costs an auth check: with the feature off or on, the
// answer is the same for everyone.
export async function isEnabledForRequest(
	feature: Feature,
	request: Request,
): Promise<boolean> {
	const mode = getFeatureMode(feature)
	if (mode !== "preview") return mode === "on"
	const { getUserIdFromRequest } = await import("~/utils/auth")
	return isEnabled(feature, {
		userId: await getUserIdFromRequest({ request }),
	})
}
