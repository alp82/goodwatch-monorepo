import { getUserIdFromRequest } from "~/utils/auth"
import { type EnabledFeatures, FEATURES, type Feature } from "~/utils/features"

// One environment variable per feature, set in Coolify and read on every call,
// so a change needs a container restart but no build. Unset or unknown values
// mean off, and the old page serves.
// - off: the feature is hidden for everyone.
// - preview: only the members listed in REC_PREVIEW_USERS see it.
// - on: everyone sees it.
export type FeatureMode = "off" | "preview" | "on"

const FEATURE_VARIABLES: Record<
	Feature,
	{ name: string; modes: readonly FeatureMode[] }
> = {
	tastePage: { name: "REC_TASTE_PAGE", modes: ["off", "preview", "on"] },
	navigation: { name: "REC_NAVIGATION", modes: ["off", "preview", "on"] },
	tracking: { name: "REC_TRACKING", modes: ["off", "preview", "on"] },
}

// Compatible with both a member ({ userId }) and a guest (no userId).
export type FeatureViewer = { userId?: string | null } | null | undefined

const warnedValues = new Set<string>()

export function getFeatureMode(feature: Feature): FeatureMode {
	const { name, modes } = FEATURE_VARIABLES[feature]
	const raw = (process.env[name] ?? "").trim().toLowerCase()
	const mode = modes.find((candidate) => candidate === raw)
	if (mode) return mode
	const warning = `${name}=${raw}`
	if (raw && !warnedValues.has(warning)) {
		warnedValues.add(warning)
		const allowed = `${modes.slice(0, -1).join(", ")} or ${modes.at(-1)}`
		console.warn(`${name}="${raw}" is not ${allowed}. Using off.`)
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

export function getEnabledFeatures(viewer: FeatureViewer): EnabledFeatures {
	return Object.fromEntries(
		FEATURES.map((feature) => [feature, isEnabled(feature, viewer)]),
	) as EnabledFeatures
}

// For loaders that don't have the user yet. Loaders that already read the
// user should call isEnabled or getEnabledFeatures with it instead, to avoid
// a second auth check.
export async function getEnabledFeaturesFromRequest({
	request,
}: {
	request: Request
}): Promise<EnabledFeatures> {
	const userId = await getUserIdFromRequest({ request })
	return getEnabledFeatures({ userId })
}
