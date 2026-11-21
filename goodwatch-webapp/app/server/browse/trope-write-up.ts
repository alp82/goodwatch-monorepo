// A TV Tropes write-up as GoodWatch shows it: its first point as plain text, with the runs TV Tropes marks as
// spoilers kept as character ranges. Spoilers come as HTML (`<span class="spoiler">`) or, in some stored write-ups,
// in the wiki form `[[spoiler:...]]`, sometimes cut before its end. A text longer than about 320 characters ends at
// its last whole sentence. Pure; server/browse/tropes.server.ts reads the rows.
import { htmlToText } from "~/server/profile/trope-text"

/** The first list item (or the whole text), with spoiler spans kept as ranges. */
export function firstPoint(html: string): { text: string; spoilers: [number, number][] } {
	const li = /<li>([\s\S]*?)(?:<\/li>|<ul>|$)/i.exec(html)
	let body = li ? li[1] : html
	body = body.replace(/<div class="indent">[\s\S]*$/i, "")
	// Mark spoilers with private-use characters, flatten the rest to text, then turn the marks into ranges.
	body = body.replace(/<span class="spoiler"[^>]*>/gi, "\uE000").replace(/<\/span>/gi, "\uE001")
	// Some write-ups keep the wiki form ([[spoiler:...]]), sometimes cut before its end.
	body = body.replace(/\[\[spoiler:([\s\S]*?)(?:\]\]|$)/gi, "\uE000$1\uE001")
	let text = htmlToText(body).replace(/\s+/g, " ").trim()
	if (text.length > 320) {
		const cut = text.slice(0, 320)
		const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "))
		text = `${end > 140 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`}`
	}
	const spoilers: [number, number][] = []
	let out = ""
	let open = -1
	for (const ch of text) {
		if (ch === "\uE000") open = out.length
		else if (ch === "\uE001") {
			if (open >= 0 && out.length > open) spoilers.push([open, out.length])
			open = -1
		} else out += ch
	}
	if (open >= 0 && out.length > open) spoilers.push([open, out.length])
	return { text: out, spoilers }
}
