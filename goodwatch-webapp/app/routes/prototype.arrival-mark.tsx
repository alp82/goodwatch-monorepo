// PROTOTYPE - throwaway. "Mark and order", prototype A of #489: more uses of the time a wanted title first appeared
// on one of a member's streaming services (#456), which today feeds only a signal that clears on the next visit.
// Two things, on the pages where they would live:
//   1. A lasting "New on <service>" mark on the title: where it sits, how it names one or several services, how
//      long it lasts and how it goes, and how it stands beside the new-episodes mark of a show.
//   2. A way to bring what landed to the top of My movies and My shows.
// Four variations of both, on four pages, switchable with the pill or the left and right arrow keys:
//   /prototype/arrival-mark?variant=A|B|C|D
//     &page=movies|shows|want|title        the page
//     &member=several|one|both|none        the sample member
//     &day=0..                             days after the start day, to watch a mark age ("Next day")
//     &title=<key>                         the title of the title page
//     &only=1                              B: the chip is on
//     &sort=match|arrived                  C: the sort of My movies and the Want to See list
//     &visit=first                         also the line the real pages say on the first visit after a landing
//     &chrome=off                          hides the prototype's own controls
// Every title's landing is made up and lives in the browser: no loader, no service, nothing written.
// Notes and screenshots: docs/prototypes/arrival-mark/README.md.
import { useSearchParams } from "@remix-run/react"
import { useMemo, useState } from "react"
import {
	Controls,
	PAGES,
	type PageKey,
} from "~/ui/prototype-arrival-mark/controls"
import { LibraryPage } from "~/ui/prototype-arrival-mark/library"
import {
	MEMBERS,
	type MemberKey,
	TITLES,
	VARIANTS,
	type VariantKey,
	marksOf,
	titleOf,
} from "~/ui/prototype-arrival-mark/model"
import { MoviesPage } from "~/ui/prototype-arrival-mark/movies"
import type { Ctx, Sort } from "~/ui/prototype-arrival-mark/parts"
import { ShowsPage } from "~/ui/prototype-arrival-mark/shows"
import { TitlePage } from "~/ui/prototype-arrival-mark/title"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [
	{ title: "Arrival mark prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const pick = <K extends string>(
	choices: Record<K, unknown>,
	value: string | null,
	fallback: K,
): K => (value !== null && value in choices ? (value as K) : fallback)

export default function ArrivalMarkPrototype() {
	const [params, setParams] = useSearchParams()
	const variant = pick<VariantKey>(VARIANTS, params.get("variant"), "A")
	const page = pick<PageKey>(PAGES, params.get("page"), "movies")
	const member = pick<MemberKey>(MEMBERS, params.get("member"), "several")
	const day = Math.max(0, Number(params.get("day")) || 0)
	// The titles the member opened during the visit. Variation D takes their marks away.
	const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())

	// An empty value takes the parameter away.
	const set = (next: Record<string, string>) =>
		setParams(
			(now) => {
				const p = new URLSearchParams(now)
				for (const [k, v] of Object.entries(next))
					v === "" ? p.delete(k) : p.set(k, v)
				return p
			},
			{ replace: true, preventScrollReset: !("page" in next) },
		)

	const marks = useMemo(
		() => marksOf(variant, member, day, opened),
		[variant, member, day, opened],
	)
	const ctx: Ctx = {
		variant,
		member,
		day,
		marks,
		open: (key) => setOpened((before) => new Set(before).add(key)),
		only: variant === "B" && params.get("only") === "1",
		setOnly: (only) => set({ only: only ? "1" : "" }),
		// The sort is shown chosen, so that what it does is on screen at once.
		sort:
			variant === "C"
				? pick<Sort>({ match: 1, arrived: 1 }, params.get("sort"), "arrived")
				: "match",
		setSort: (sort) => set({ sort }),
		firstVisit: params.get("visit") === "first",
	}

	// The title page shows a title that landed on two services, when the member has one.
	const landed = Object.entries(MEMBERS[member].landed)
	const fallback =
		landed.find(([, { on }]) => on.length > 1)?.[0] ?? landed[0]?.[0] ?? "dune2"
	const wanted = params.get("title")
	const titleKey =
		wanted && TITLES.some((title) => title.key === wanted) ? wanted : fallback

	return (
		<>
			<span hidden data-page-shown={page} />
			{page === "movies" && <MoviesPage ctx={ctx} />}
			{page === "shows" && <ShowsPage ctx={ctx} />}
			{page === "want" && <LibraryPage ctx={ctx} />}
			{page === "title" && <TitlePage title={titleOf(titleKey)} ctx={ctx} />}
			<Controls
				ctx={ctx}
				page={page}
				titleKey={titleKey}
				opened={opened}
				set={set}
				reset={() => {
					setOpened(new Set())
					set({ day: "", only: "", sort: "", visit: "" })
				}}
				hidden={params.get("chrome") === "off"}
			/>
		</>
	)
}
