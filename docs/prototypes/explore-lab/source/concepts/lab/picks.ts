// PROTOTYPE - throwaway (prototype/explore-r5). The lab's picks as text: the cookie `gw-lab` and the `?lab=`
// parameter both read `slot:variant,slot:variant`. Pure: loader and browser.
export const LAB_COOKIE = "gw-lab"
export const LAB_PARAM = "lab"

export function parsePicks(text: string | null | undefined): Record<string, string> {
	const out: Record<string, string> = {}
	for (const pair of (text ?? "").split(",")) {
		const [slot, variant] = pair.split(":").map((s) => s.trim())
		if (slot && variant && /^[\w-]+$/.test(slot) && /^[\w-]+$/.test(variant)) out[slot] = variant
	}
	return out
}

export const formatPicks = (picks: Record<string, string>) =>
	Object.entries(picks)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([slot, variant]) => `${slot}:${variant}`)
		.join(",")

export function cookiePicks(cookieHeader: string | null | undefined): Record<string, string> {
	for (const part of (cookieHeader ?? "").split(";")) {
		const [name, ...rest] = part.trim().split("=")
		if (name === LAB_COOKIE) {
			try {
				return parsePicks(decodeURIComponent(rest.join("=")))
			} catch {
				return {}
			}
		}
	}
	return {}
}
