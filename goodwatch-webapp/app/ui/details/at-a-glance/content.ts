// What At a glance's Content row says, worked out from a title's details and its title analysis. Pure, so the row,
// its opened guide, the sub-page and find read the same words.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { goodFor } from "~/ui/details/fingerprint/area-details"
import { GUIDE } from "~/ui/details/fingerprint/viewing-guide"
import {
	ageRating,
	ageWord,
	fingerprintInput,
	shortList,
} from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"

type Media = MovieResult | ShowResult

/** The sub-scores that say how much of each kind of content there is, and the advisories that name each kind. */
export const CONTENT_SCALES: {
	key: string
	label: string
	advisory: RegExp
}[] = [
	{ key: "violence", label: "Violence", advisory: /violen/i },
	{
		key: "grotesque",
		label: "Gore, disturbing images",
		advisory: /gore|disturb|blood/i,
	},
	{
		key: "scare",
		label: "Frightening scenes",
		advisory: /fright|scar|horror/i,
	},
	{ key: "eroticism", label: "Sex, nudity", advisory: /sex|nud/i },
	{ key: "bleakness", label: "Dark themes", advisory: /theme|suicide|death/i },
]

/** A content score (0-10) in a word. */
export const severity = (v: number) =>
	v >= 9
		? "Intense"
		: v >= 7
			? "Strong"
			: v >= 5
				? "Moderate"
				: v >= 3
					? "Mild"
					: "Little or none"

const sentenceCase = (x: string) => x.charAt(0) + x.slice(1).toLowerCase()

/** Every age rating the page has (the visitor's country and the fallback one), the visitor's first. */
export function ratings(media: Media, country: string) {
	return (media.details.age_certifications ?? [])
		.map((c) => {
			const [cc, cert] = c.split("_")
			return { cc, cert }
		})
		.filter((r) => r.cert)
		.sort((a, b) => Number(b.cc === country) - Number(a.cc === country))
}

/** Who the viewing guide says it suits, in a few words: for kids, teens and up, or adults. */
function audienceWords(media: Media): string | null {
	const t = fingerprintInput(media)
	if (!t) return null
	const who = goodFor(t)
	if (who.some((w) => w.includes("kid") || w.includes("family")))
		return "Fine for kids"
	if (who.some((w) => w.includes("teen"))) return "Teens and up"
	return "Adults"
}

export interface ContentSummary {
	/** "PG-13 · Violence, strong language". */
	value: string
	/** The kid verdict in a few words ("Not for young kids"), or null when there is none short enough. */
	verdict: string | null
}

/** The closed Content row, or null when the title has neither an age rating nor content advisories. */
export function contentSummary(
	media: Media,
	country: string,
	questions: TitleQuestion[],
): ContentSummary | null {
	const age = ageWord(ageRating(media, country))
	const advisories = (media.details.content_advisories ?? []).map((a, i) =>
		i ? a.toLowerCase() : sentenceCase(a),
	)
	if (!age && !advisories.length) return null
	const kids = questions.find((q) => q.id === "kids")
	const verdict = kids ? kids.a.split(":")[0] : audienceWords(media)
	return {
		value: [age, shortList(advisories, 2)].filter(Boolean).join(" · "),
		verdict: verdict && verdict.length <= 28 ? verdict : null,
	}
}

export interface ContentLevel {
	key: string
	label: string
	/** 0-10 from the title analysis. */
	value: number
	/** Whether a content advisory names this kind. */
	named: boolean
}

/** How strong each kind of content is, and the advisories no scale covers (strong language, drug use, ...). */
export function contentLevels(media: Media): {
	levels: ContentLevel[]
	unscaled: string[]
} {
	const advisories = media.details.content_advisories ?? []
	const scores = (fingerprintInput(media)?.fingerprint.scores ??
		{}) as unknown as Record<string, number>
	const levels = CONTENT_SCALES.filter(
		(c) => typeof scores[c.key] === "number",
	).map((c) => ({
		key: c.key,
		label: c.label,
		value: scores[c.key],
		named: advisories.some((a) => c.advisory.test(a)),
	}))
	const unscaled = advisories
		.filter((a) => !CONTENT_SCALES.some((c) => c.advisory.test(a)))
		.map(sentenceCase)
	return { levels, unscaled }
}

/** The viewing guide's audiences and occasions, and the family ones it doesn't list. */
export function viewingGuide(media: Media): {
	listed: string[]
	notFor: string[]
} {
	const t = fingerprintInput(media)
	const listed = [
		...(t?.fingerprint.socialSuitability ?? []),
		...(t?.fingerprint.viewingContext ?? []),
	].map((x) => x.name)
	const notFor = [GUIDE.kids, GUIDE.familyNight].filter(
		(x) => !listed.includes(x),
	)
	return { listed, notFor }
}
