// A title's TV Tropes write-up for one trope as paragraphs of runs with the spoilers marked, so the page can cover
// them. The types and the teaser rule; the parsing is in title-tropes.server.ts.

export interface Run {
	text: string
	spoiler?: true
}
export type Paragraph = Run[]

/**
 * The closed band's line: the first sentence (or two short ones) with no spoiler in it, so it can show uncovered.
 * Null when every paragraph opens on a spoiler.
 */
export function safeTeaser(ps: Paragraph[], max = 240): string | null {
	for (const p of ps) {
		let text = ""
		for (const r of p) {
			if (r.spoiler) break
			text += r.text
		}
		const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g)
		if (!sentences?.length) continue
		let out = ""
		for (const s of sentences) {
			if (out && (out + s).length > max) break
			out += s
			if (out.length > 90) break
		}
		out = out.trim()
		if (out.length >= 24)
			return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out
	}
	return null
}
