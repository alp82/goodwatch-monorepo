// Find in this title's matches on the sub-pages (sub-page-index.ts), as find's items: one group a sub-page, headed by
// its name ("Fingerprint", "At a glance", "Tropes"), and "here" on that sub-page itself. Nothing is built or fetched
// until find is used (`armed`: the field focused or typed in); the tropes come from the tropes page's own request, so
// going in to Tropes reuses it.
//
// The title page's own index is kept for its sub-pages (keepPageIndex), so find on a sub-page finds what the title page
// has too (its episodes, services, scores); a sub-page loaded directly builds one from the title alone.
import { useMemo } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { FindItem } from "~/ui/details/find/Find"
import { type FindEntry, findIn } from "~/ui/details/find/find-index"
import { SUB, type SubKind } from "~/ui/details/sub-page/paths"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { useAllTropes } from "~/ui/details/tropes/model"
import {
	type SubEntry,
	fingerprintEntries,
	glanceEntries,
	tropesEntries,
} from "./sub-page-index"

type Media = MovieResult | ShowResult

const ORDER: SubKind[] = ["fingerprint", "at-a-glance", "tropes"]
/** Matches a sub-page shows at most (its own page has the rest). */
const PER_SUB = 6

export function useCrossFind({
	media,
	country,
	questions,
	query,
	armed,
	here,
	onPick,
}: {
	media: Media
	country: string
	questions: TitleQuestion[]
	query: string
	armed: boolean
	/** Where find is: the title page, or one of its sub-pages (its group comes first, as "here"). */
	here: "page" | SubKind
	onPick: (entry: SubEntry) => void
}): { items: FindItem[]; own: FindItem[]; busy: boolean } {
	const tropes = useAllTropes(media.mediaType, media.details.tmdb_id, armed)
	const fp = useMemo(
		() => (armed ? fingerprintEntries(media) : []),
		[armed, media],
	)
	const glance = useMemo(
		() => (armed ? glanceEntries(media, country, questions) : []),
		[armed, media, country, questions],
	)
	const tr = useMemo(
		() => (tropes.data ? tropesEntries(tropes.data) : []),
		[tropes.data],
	)
	const on = query.trim().length >= 2
	const byKind: Record<SubKind, SubEntry[]> = {
		fingerprint: fp,
		"at-a-glance": glance,
		tropes: tr,
	}
	const items: FindItem[] = []
	const own: FindItem[] = []
	if (on)
		for (const kind of here === "page"
			? ORDER
			: [here, ...ORDER.filter((k) => k !== here)]) {
			const sub = SUB[kind]
			for (const hit of findIn(byKind[kind], query, PER_SUB))
				(kind === here ? own : items).push({
					key: hit.entry.key,
					group: sub.label,
					groupKey: `sub:${kind}`,
					groupNote: kind === here ? "here" : undefined,
					icon: sub.icon,
					title: hit.entry.title,
					context: hit.entry.context,
					body: hit.entry.body,
					at: hit.at,
					pick: () => onPick(hit.entry),
				})
		}
	return { items, own, busy: on && armed && tropes.isPending }
}

// --- The title page's index, kept for its sub-pages --------------------------------------------------------------

export interface KeptIndex {
	entries: FindEntry[]
	sections: { id: string; label: string }[]
}

const KEPT = "find-page-index:"

export function keepPageIndex(key: string, kept: KeptIndex) {
	try {
		sessionStorage.setItem(KEPT + key, JSON.stringify(kept))
	} catch {}
}

export function keptPageIndex(key: string): KeptIndex | null {
	try {
		const raw = sessionStorage.getItem(KEPT + key)
		return raw ? (JSON.parse(raw) as KeptIndex) : null
	} catch {
		return null
	}
}

export const titleKey = (media: Media) =>
	`${media.mediaType}-${media.details.tmdb_id}`
