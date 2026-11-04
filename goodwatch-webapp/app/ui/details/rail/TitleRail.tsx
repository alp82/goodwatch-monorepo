// The title page's rail: its sections, each lit while it is on screen, and for a section with a sub-page (Fingerprint,
// At a glance, Tropes) or an expanded view (More like this) the way in as a tab out to the entry's right while the
// section is on screen (RailNav.tsx). With More like this's expanded view open, the rail is that view's own: Back to
// details, More like this selected, and its shelves as the children (small shelf cards, the open one marked; a press
// hops to another, a press on another entry folds the view first).
// The entries and their gists are kept for the sub-pages' rail (rail-model.ts), so it is the same list there.
import { useEffect } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { IndexItem } from "~/ui/details/ProgressIndex"
import { barBottom } from "~/ui/details/more-like-this/expanded-frame"
import { fmt } from "~/ui/details/page-ui"
import { subPagePath } from "~/ui/details/sub-page/paths"
import { tropeNames } from "~/ui/details/title-words"
import { type NavEntry, RailNav } from "./RailNav"
import { keepEntries, keptIcons, useShelves } from "./rail-model"

type Media = MovieResult | ShowResult

/** A shelf shows a row of eight; the expanded view is worth opening only when some shelf has more. */
const ROW_FITS = 8

export function TitleRail({
	items,
	visible,
	onJump,
	media,
}: {
	items: IndexItem[]
	visible: string[]
	onJump: (id: string) => void
	media: Media
}) {
	const shelves = useShelves()
	const opened = shelves?.opened ?? null
	const key = `${media.mediaType}-${media.details.tmdb_id}`
	const sig = items.map((i) => `${i.id}:${i.label}:${i.peek ?? ""}`).join("|")
	useEffect(() => {
		keepEntries(
			key,
			items.map(({ id, label, peek }) => ({ id, label, peek })),
		)
		for (const i of items) keptIcons.set(i.id, i.icon)
	}, [key, sig])

	// The expanded view open (or closed): its rail starts at the top.
	useEffect(() => {
		const f = requestAnimationFrame(() => {
			const box = document
				.querySelector<HTMLElement>("[data-rail-nav]")
				?.closest<HTMLElement>(".overflow-y-auto")
			box?.scrollTo({ top: 0, behavior: "auto" })
		})
		return () => cancelAnimationFrame(f)
	}, [!!opened])

	const go = (id: string) => {
		if (opened) {
			// The shelves have the column: fold them first, then go.
			shelves?.close()
			window.setTimeout(() => onJump(id), 320)
			return
		}
		onJump(id)
	}

	const tropesTotal = tropeNames(media).total
	const wayInOf = (id: string): NavEntry["wayIn"] => {
		if (id === "fingerprint")
			return {
				label: "Open the whole fingerprint",
				href: subPagePath("fingerprint", media),
			}
		if (id === "tropes")
			return {
				label: tropesTotal
					? `Open all ${fmt(tropesTotal)} tropes`
					: "Open every trope",
				href: subPagePath("tropes", media),
			}
		if (id === "at-a-glance")
			return {
				label: "Open every row in full",
				href: subPagePath("at-a-glance", media),
			}
		if (id === "more-like-this" && shelves) {
			// Every shelf is a block of the expanded view, so it opens at the first (the watch order, if any).
			const more = shelves.shelves.some((s) => s.count > ROW_FITS)
			const first = shelves.shelves[0]
			return more && first
				? { label: "Open every shelf", onSelect: () => shelves.open(first.id) }
				: null
		}
		return null
	}

	// The expanded view open: Back to details, then More like this (selected) and its shelves, nothing else.
	if (opened && shelves) {
		const more = items.find((it) => it.id === "more-like-this")
		if (more)
			return (
				<RailNav
					back={{ label: "Back to details", onSelect: () => shelves.close() }}
					entries={[
						{
							id: more.id,
							label: more.label,
							icon: more.icon,
							peek: more.peek,
							selected: true,
							progress: null,
							onSelect: () => go("more-like-this"),
							children: shelves.shelves.map((s) => ({
								id: s.id,
								label: s.title,
								kind: s.kind,
								meta: String(s.count),
								pile: s.posters,
								onSelect: () => shelves.hop(s.id),
								// The shelf's block in the expanded view, for the line over what is on screen.
								target: () =>
									document.querySelector(
										`[data-shelf-block="${CSS.escape(s.id)}"]`,
									),
							})),
							activeChild: opened,
							spanTop: barBottom,
						},
					]}
				/>
			)
	}

	const entries: NavEntry[] = items.map((it) => ({
		id: it.id,
		label: it.label,
		icon: it.icon,
		peek: it.peek,
		on: visible.includes(it.id),
		onSelect: () => go(it.id),
		wayIn: wayInOf(it.id),
	}))
	return <RailNav entries={entries} />
}
