// How a hide count reads (Discover's Matches popout and its "hidden" label): bucketed down, never
// rounded up. 0–9 as they are, 10–99 in tens, 100–999 in hundreds, thousands as whole "k" (23,753 → 23k), millions as
// whole "M". "~" when the count is an estimate or the bucket drops precision (86 → ~80, 1,000 → 1k). Only for display:
// sorting, the meter and the totals keep the raw counts.

export function hideBucket(n: number): { text: string; lossy: boolean } {
	const v = Math.max(0, Math.floor(n))
	const floorTo = (step: number) => Math.floor(v / step) * step
	if (v < 10) return { text: String(v), lossy: false }
	if (v < 100) return { text: String(floorTo(10)), lossy: v % 10 !== 0 }
	if (v < 1000) return { text: String(floorTo(100)), lossy: v % 100 !== 0 }
	if (v < 1_000_000) return { text: `${Math.floor(v / 1000)}k`, lossy: v % 1000 !== 0 }
	return { text: `${Math.floor(v / 1_000_000)}M`, lossy: v % 1_000_000 !== 0 }
}

/** For plain text (the compact "hidden" label). */
export function hideText(n: number, approx = false): string {
	const { text, lossy } = hideBucket(n)
	return `${approx || lossy ? "~" : ""}${text}`
}
