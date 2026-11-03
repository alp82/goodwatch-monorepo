// A year written after a title's words, the way titles are cited: "dune 1984", "Time Travel (2011)". It asks for that
// title, so the search keeps the year with the words (the Discover interpreter doesn't turn it into a year filter) and
// the title blend matches the words before it (search-ranking/title-blend.server.ts). A year after a filter word
// ("from 1984", "in 2011"), a genre or format word ("horror 1999", "movies 2011"), or a decade ("80s") is a filter, as
// is a year after the current one plus two ("blade runner 2049" is a title whose words end in a number). Pure, shared
// by the server and the browser.

// The title ends in a letter or digit, maybe followed by marks or punctuation ("Roger Rabbit? 1988").
const CITED =
	/^(.*?[\p{L}\p{N}][\p{M}\p{P}]*)[\s(]+((?:18|19|20)\d{2})\)?[\s.!?]*$/u
const FILTER_WORD =
	/(?:^|\s)(?:from|in|since|after|before|until|till|to|and|or|between|released|release|year|of|the|circa|around|movies?|films?|shows?|series|tv|anime|cartoons?|documentar(?:y|ies)|docs?|horror|comed(?:y|ies)|drama|dramas|thrillers?|action|romance|romcoms?|sci[- ]?fi|fantasy|crime|mystery|westerns?|musicals?|war|animated|animation|kids|family|adventure|history|k[- ]?dramas?)$/i

export function citedYear(
	query: string,
	now = new Date(),
): { title: string; year: number } | null {
	const m = CITED.exec(query.normalize("NFC").trim())
	if (!m) return null
	const title = m[1].trim()
	const year = Number(m[2])
	if (year > now.getUTCFullYear() + 2) return null
	if (!/\p{L}/u.test(title) || FILTER_WORD.test(title)) return null
	return { title, year }
}
