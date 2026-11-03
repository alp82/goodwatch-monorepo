// How the title page folds a synopsis: whole when it is short, otherwise its first sentences behind "More".

// Splits after the first sentence end that isn't an abbreviation ("Dr.", "U.S.", "Vol."), a lone initial or a
// decimal. Also handles CJK full stops.
const ABBREV =
	/(?:\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Vs|vs|Vol|No|Mt|Ft|Lt|Col|Gen|Capt|Sgt|Prof|Inc|Co|etc)|\b[A-Z]|\b(?:[A-Z]\.)+[A-Z])\.$/
export function splitLead(text: string): [string, string] {
	const t = text.trim()
	const re = /[.!?…](?=["'”’)]?\s+["'“‘(]?[A-Z0-9À-Ý])|[。！？](?=.)/g
	for (let m = re.exec(t); m; m = re.exec(t)) {
		const end = m.index + 1
		const close = t.slice(end).match(/^["'”’)]*/)?.[0].length ?? 0
		if (/[.]/.test(m[0]) && ABBREV.test(t.slice(0, end))) continue
		if (end < 40) continue // too short to stand alone ("Meet Bob."), keep going
		return clause(t.slice(0, end + close), t.slice(end + close).trim())
	}
	return clause(t, "")
}

// A first sentence over 34 words is cut at its last clause break after word 12; the rest continues behind "…".
function clause(lead: string, rest: string): [string, string] {
	const words = lead.split(/\s+/)
	if (words.length <= 34) return [lead, rest]
	const head = words.slice(0, 30).join(" ")
	const minAt = words.slice(0, 12).join(" ").length
	const at = Math.max(
		head.lastIndexOf(", "),
		head.lastIndexOf(" – "),
		head.lastIndexOf(" — "),
		head.lastIndexOf("--"),
		head.lastIndexOf(" and "),
		head.lastIndexOf(" who "),
		head.lastIndexOf(" where "),
	)
	if (at < minAt) return [lead, rest]
	const tail = lead
		.slice(at)
		.replace(/^(,|--| –| —)\s*/, (m) => (m.startsWith(",") ? "" : m))
		.trim()
	return [`${lead.slice(0, at)}…`, `${tail} ${rest}`.trim()]
}

// Splits a text into sentences with the same rules as splitLead.
function sentences(text: string): string[] {
	const out: string[] = []
	let rest = text.trim()
	while (rest) {
		const [lead, after] = splitLead(rest)
		if (lead.endsWith("…")) {
			// splitLead cut a long sentence at a clause: keep the sentence whole here.
			const [whole, next] = wholeFirst(rest)
			out.push(whole)
			rest = next
			continue
		}
		out.push(lead)
		rest = after
	}
	return out
}
function wholeFirst(t: string): [string, string] {
	const re = /[.!?…](?=["'”’)]?\s+["'“‘(]?[A-Z0-9À-Ý])|[。！？](?=.)/g
	for (let m = re.exec(t); m; m = re.exec(t)) {
		const end = m.index + 1
		if (/[.]/.test(m[0]) && ABBREV.test(t.slice(0, end))) continue
		if (end < 40) continue
		const close = t.slice(end).match(/^["'”’)]*/)?.[0].length ?? 0
		return [t.slice(0, end + close), t.slice(end + close).trim()]
	}
	return [t, ""]
}
const words = (s: string) => (s ? s.split(/\s+/).length : 0)

/**
 * The synopsis as the page shows it: whole when it is short, otherwise whole sentences up to about 40 words (one long
 * first sentence is cut at a clause). "More" appears only when at least 25 words stay hidden: unfolding for a few
 * words isn't worth a click.
 */
export function foldSynopsis(text: string): {
	shown: string
	hidden: string
	cut: boolean
} {
	const t = text.trim()
	if (words(t) <= 60) return { shown: t, hidden: "", cut: false }
	const all = sentences(t)
	let shown = all[0]
	let i = 1
	while (i < all.length && words(shown) + words(all[i]) <= 40)
		shown += ` ${all[i++]}`
	let hidden = all.slice(i).join(" ")
	let cut = false
	if (words(shown) > 45) {
		const [head, tail] = splitLead(shown)
		if (head.endsWith("…")) {
			shown = head
			hidden = `${tail} ${hidden}`.trim()
			cut = true
		}
	}
	if (words(hidden) < 25) return { shown: t, hidden: "", cut: false }
	return { shown, hidden, cut }
}
