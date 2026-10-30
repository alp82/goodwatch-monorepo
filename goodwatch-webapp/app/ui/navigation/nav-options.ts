// PROTOTYPE OPTIONS - remove after the owner picks (member nav, rounds 8-11). Not a feature switch: these let the owner
// compare navigation options on the local preview branch. The choice lives in one cookie; the root loader reads it
// for the server render, and the options bar sets it and reloads the page.
import { useRouteLoaderData } from "@remix-run/react"

export const NAV_OPTIONS = {
	/** The orbit ring's style around the avatar (round 11; the orbit ring itself is locked). */
	orbit: ["dots", "comets", "constellation", "bands", "sparks"],
	/** What a click on the orbit avatar opens in the header: the fingerprint's key facts. */
	reveal: ["pill", "panel", "morph", "card"],
	/** How a member visitor sees the match with the profile in the header. */
	compare: ["chip", "gauge", "overlap", "halves"],
	/** How New picks its country, in place of the breadcrumb bar. */
	country: ["title", "flag", "chips", "sheet"],
} as const

export type NavOptionKey = keyof typeof NAV_OPTIONS
export type NavOptions = { [K in NavOptionKey]: (typeof NAV_OPTIONS)[K][number] }

export const DEFAULT_NAV_OPTIONS: NavOptions = { orbit: "dots", reveal: "pill", compare: "chip", country: "title" }

export const NAV_OPTIONS_COOKIE = "gw_navopt"

/** Reads `seen:tab,header:cover` from the cookie; unknown keys and values fall back to the defaults. */
export function parseNavOptions(cookieHeader: string | null | undefined): NavOptions {
	const options: NavOptions = { ...DEFAULT_NAV_OPTIONS }
	const raw = (cookieHeader ?? "")
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${NAV_OPTIONS_COOKIE}=`))
	if (!raw) return options
	for (const pair of decodeURIComponent(raw.slice(NAV_OPTIONS_COOKIE.length + 1)).split(",")) {
		const [key, value] = pair.split(":")
		if (!(key in NAV_OPTIONS)) continue
		const allowed = NAV_OPTIONS[key as NavOptionKey] as readonly string[]
		if (allowed.includes(value)) (options as Record<string, string>)[key] = value
	}
	return options
}

export function serializeNavOptions(options: NavOptions): string {
	return (Object.keys(NAV_OPTIONS) as NavOptionKey[]).map((key) => `${key}:${options[key]}`).join(",")
}

/** The current options, from the root loader's data. */
export function useNavOptions(): NavOptions {
	const root = useRouteLoaderData("root") as { navOptions?: NavOptions } | undefined
	return root?.navOptions ?? DEFAULT_NAV_OPTIONS
}

/** Sets one option and reloads, so every loader and layout renders with it. */
export function setNavOption<K extends NavOptionKey>(current: NavOptions, key: K, value: NavOptions[K]): void {
	const next = serializeNavOptions({ ...current, [key]: value })
	document.cookie = `${NAV_OPTIONS_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`
	window.location.reload()
}
