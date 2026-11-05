// Optional palette reads may fail without failing the panel. Report each operation at most once a minute.
const reported = new Map<string, number>()
export function paletteFailure(key: string, error: unknown) {
	const now = Date.now()
	if (now - (reported.get(key) ?? 0) < 60_000) return
	reported.set(key, now)
	console.warn(`Palette ${key} failed`, error)
}
