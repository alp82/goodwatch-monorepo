import { resolveRecG1 } from "../utils/features.ts"

// Shadow is restricted to the explicit preview list too: the first trial belongs to the owner.
export function recG1Order(userId: string | null) {
	return resolveRecG1(
		process.env.REC_G1_ORDER,
		process.env.REC_PREVIEW_USERS,
		userId,
	)
}

// Release flags: one environment variable per feature, set in Coolify and read on every call, so a change needs a
// container restart but no build (the restart also empties the in-process page cache). Unset or unknown values mean
// off, and the page serves as before.
// - off: the feature is hidden for everyone.
// - on: everyone sees it.
// The same scheme as the REC_* flags that went on October 14, 2026 (docs/implementation/tv-screen-revamp/rec-flags/),
// without their preview list.
export type FeatureMode = "off" | "on"

const FEATURE_VARIABLES = {
	// The connector launch (map #529): the help page at /connect and the privacy policy for connected apps and
	// self-hosted sign-in. Turned on together with the cut-over and /mcp (#552, #572).
	connector: { name: "REC_CONNECTOR", modes: ["off", "on"] },
} as const satisfies Record<
	string,
	{ name: string; modes: readonly FeatureMode[] }
>

export type Feature = keyof typeof FEATURE_VARIABLES

const warnedValues = new Set<string>()

export function getFeatureMode(feature: Feature): FeatureMode {
	const { name, modes }: { name: string; modes: readonly FeatureMode[] } =
		FEATURE_VARIABLES[feature]
	const raw = (process.env[name] ?? "").trim().toLowerCase()
	const mode = modes.find((candidate) => candidate === raw)
	if (mode) return mode
	const warning = `${name}=${raw}`
	if (raw && !warnedValues.has(warning)) {
		warnedValues.add(warning)
		console.warn(`${name}="${raw}" is not ${modes.join(" or ")}. Using off.`)
	}
	return "off"
}

export function isEnabled(feature: Feature): boolean {
	return getFeatureMode(feature) === "on"
}
