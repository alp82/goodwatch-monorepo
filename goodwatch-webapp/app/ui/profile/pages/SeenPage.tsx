import { useMemo, useState } from "react"
// The profile's Seen tab: a diary, latest first, one group per month; titles without a watch date (older imports,
// most shows) close the page under "No date". Each row ends in the score pill (GoodWatch and the viewer's own score);
// on another member's profile their score follows it, and a signed-in visitor's services show on what they haven't
// seen.
import type { LibraryKind } from "~/domain/my-library"
import type {
	ProfileSeenPage,
	ProfileShell,
	ProfileTitle,
} from "~/domain/profile"
import type { RowServices } from "~/server/row-services.server"
import type { Score } from "~/server/scores.server"
import {
	RowLogos,
	RowScores,
	rowMark,
	useRowMarks,
} from "~/ui/list-row/RowScores"
import { DISPLAY } from "~/ui/my-pages/bits"
import { OwnerPageLink, Segmented, TILE, TitleRow, count } from "../parts"

type Kind = LibraryKind
const FIRST_MONTHS = 6
const FIRST_UNDATED = 40

const monthOf = (iso: string) =>
	new Date(iso).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	})
const dayOf = (iso: string) => new Date(iso).getUTCDate()

export function SeenPage({
	shell,
	page,
	services,
}: {
	shell: ProfileShell
	page: ProfileSeenPage
	/** A signed-in visitor's own services on the titles they haven't seen; null otherwise. */
	services: RowServices | null
}) {
	const [kind, setKind] = useState<Kind>("all")
	const [months, setMonths] = useState(FIRST_MONTHS)
	const [allUndated, setAllUndated] = useState(false)
	const titles = useMemo(
		() =>
			kind === "all"
				? page.titles
				: page.titles.filter((t) => t.mediaType === kind),
		[page.titles, kind],
	)
	const { groups, undated } = useMemo(() => byMonth(titles), [titles])
	const movies = page.titles.filter((t) => t.mediaType === "movie").length
	const marksOf = useRowMarks()
	const other = shell.viewer !== "owner"
	const parts = (title: ProfileTitle) => {
		const marks = marksOf(title.mediaType, title.tmdbId)
		return {
			logos: <RowLogos services={services?.[title.key]} />,
			end: (
				<RowScores
					goodwatch={title.gw}
					score={marks.score}
					mark={rowMark(marks)}
					owner={other ? (title.score as Score | null) : null}
					ownerName={`@${shell.handle}`}
				/>
			),
		}
	}

	if (!page.titles.length)
		return (
			<p className={`${TILE} px-6 py-14 text-center text-gray-400`}>
				{shell.viewer === "owner"
					? "Nothing marked as seen yet."
					: `@${shell.handle} hasn't marked anything as seen yet.`}
			</p>
		)

	return (
		<>
			<div className="flex flex-wrap items-center gap-3">
				<Segmented
					label="Movies or shows"
					value={kind}
					onChange={setKind}
					options={[
						["all", `All ${count(page.titles.length)}`],
						["movie", `Movies ${count(movies)}`],
						["show", `Shows ${count(page.titles.length - movies)}`],
					]}
				/>
				<span className="grow" />
				{shell.viewer === "owner" && (
					<OwnerPageLink to="/my-library/seen">
						Open in My library
					</OwnerPageLink>
				)}
			</div>
			{page.total > page.titles.length && (
				<p className="text-xs text-gray-500">
					The latest {count(page.titles.length)} of {count(page.total)}.
				</p>
			)}

			{groups.slice(0, months).map(([month, list]) => (
				<section key={month} className={`${TILE} p-4 sm:p-5`}>
					<h2 className="flex items-baseline gap-2 border-b border-white/10 pb-2">
						<span className={`${DISPLAY} text-xl`}>{month}</span>
						<span className="text-sm tabular-nums text-gray-500">
							{list.length}
						</span>
					</h2>
					<ul className="divide-y divide-white/5">
						{list.map((title) => (
							<TitleRow
								key={title.key}
								title={title}
								{...parts(title)}
								lead={
									<span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums text-gray-400">
										{dayOf(title.date as string)}
									</span>
								}
							/>
						))}
					</ul>
				</section>
			))}
			{groups.length > months && (
				<button
					type="button"
					onClick={() => setMonths((m) => m + FIRST_MONTHS)}
					className="self-start rounded-full bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-100 ring-1 ring-white/15 hover:bg-white/[0.1]"
				>
					Show earlier months
				</button>
			)}

			{undated.length > 0 && (
				<section className={`${TILE} p-4 sm:p-5`}>
					<h2 className="flex items-baseline gap-2 border-b border-white/10 pb-2">
						<span className={`${DISPLAY} text-xl`}>No date</span>
						<span className="text-sm tabular-nums text-gray-500">
							{count(undated.length)}
						</span>
					</h2>
					<p className="mt-2 text-xs text-gray-500">
						Seen before GoodWatch kept dates, or brought in without one.
					</p>
					<ul className="divide-y divide-white/5">
						{(allUndated ? undated : undated.slice(0, FIRST_UNDATED)).map(
							(title) => (
								<TitleRow key={title.key} title={title} {...parts(title)} />
							),
						)}
					</ul>
					{undated.length > FIRST_UNDATED && (
						<button
							type="button"
							onClick={() => setAllUndated((a) => !a)}
							className="mt-3 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-100 ring-1 ring-white/15 hover:bg-white/[0.1]"
						>
							{allUndated ? "Show fewer" : `Show all ${count(undated.length)}`}
						</button>
					)}
				</section>
			)}
		</>
	)
}

function byMonth(titles: ProfileTitle[]) {
	const groups = new Map<string, ProfileTitle[]>()
	const undated: ProfileTitle[] = []
	for (const t of titles) if (!t.date) undated.push(t)
	const dated = titles
		.filter((t) => t.date)
		.sort((a, b) => (b.date as string).localeCompare(a.date as string))
	for (const t of dated) {
		const month = monthOf(t.date as string)
		groups.set(month, [...(groups.get(month) ?? []), t])
	}
	return { groups: [...groups.entries()], undated }
}
