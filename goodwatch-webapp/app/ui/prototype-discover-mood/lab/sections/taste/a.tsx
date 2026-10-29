// PROTOTYPE - throwaway. Your taste baseline, round 7: find a title (or take one from this list, or for a member from
// their scored titles) and thumb it up or down. What's thumbed lands as removable filter chips in two dashed wells
// ("More like", "Less like"), so it reads as steering this list, next to the member's kept scores. Taste match on the
// right (a guest sees what it does and one Sign up). Guest or member comes from the lab bar. Round 9: empty wells offer
// a few titles to tap in instead of empty slots.
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { useState } from "react"
import type { SectionProps } from "../../types"
import { MEMBER_RATINGS, MemberMatch, RatedRow, SteerWell, useRated } from "./member"
import { Head, RowsLoading, SIGN_UP_ITEMS, SignUpBlock, SteerRow, TitleField, clearSteer, listPicks, useSteer, useTitleSearch } from "./parts"

type Source = "rated" | "list"

export function TasteA({ d, phone, text, viewer }: SectionProps) {
	const member = viewer === "member"
	const steer = useSteer(d)
	const rated = useRated()
	const [find, setFind] = useState(text)
	const [source, setSource] = useState<Source>("rated")
	const { picks, loading } = useTitleSearch(find)
	const searching = find.trim().length >= 2
	const rows = 4
	const from: Source = member ? source : "list"
	const [ratedStart, setRatedStart] = useState(0)

	const sourceTabs = member && !searching && (
		<span className="flex gap-1">
			{(
				[
					["rated", "Scored by you"],
					["list", "In this list"],
				] as const
			).map(([s, label]) => (
				<button
					key={s}
					type="button"
					aria-pressed={from === s}
					onClick={() => setSource(s)}
					className={`h-6 rounded-full px-2.5 text-[12px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
						from === s ? "bg-white/[0.12] font-semibold text-white" : "text-gray-500 hover:text-gray-200"
					}`}
				>
					{label}
				</button>
			))}
		</span>
	)
	const ratedShown = rated.slice(ratedStart, ratedStart + rows)
	const body = searching ? (
		picks.length ? (
			picks.slice(0, rows).map((t) => <SteerRow key={t.key} steer={steer} t={t} />)
		) : !loading ? (
			<p className="px-2 pt-2 text-[13px] text-gray-500">No title called “{find.trim()}”</p>
		) : (
			<RowsLoading n={rows} />
		)
	) : from === "rated" ? (
		ratedShown.length ? (
			ratedShown.map((t) => <RatedRow key={t.key} steer={steer} t={t} />)
		) : (
			<RowsLoading n={rows} />
		)
	) : listPicks(d, rows).length ? (
		listPicks(d, rows).map((t) => <SteerRow key={t.key} steer={steer} t={t} />)
	) : (
		<RowsLoading n={rows} />
	)

	const add = (
		<section className="min-w-0">
			<TitleField value={find} onChange={setFind} loading={loading} />
			<div className="mt-3 mb-1 flex h-6 items-center gap-2 px-2">
				{sourceTabs || <span className="text-[12px] text-gray-500">{searching ? `Titles called “${find.trim()}”` : "In this list"}</span>}
				{from === "rated" && !searching && rated.length > rows && (
					<button
						type="button"
						onClick={() => setRatedStart((s) => (s + rows >= rated.length ? 0 : s + rows))}
						className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						More
					</button>
				)}
			</div>
			<div style={{ height: rows * 58 }}>{body}</div>
		</section>
	)
	// Empty wells offer titles to tap in: a member's high and low scores, else titles further down this list.
	const more = member ? rated.filter((t) => t.score >= 8) : listPicks(d, 10).slice(rows, rows + 3)
	const less = member ? rated.filter((t) => t.score <= 4) : listPicks(d, 10).slice(rows + 3, rows + 6)
	const wells = (
		<section className="flex min-w-0 flex-col gap-3">
			<SteerWell steer={steer} group="loved" slots={phone ? 2 : 3} onClear={() => clearSteer(d, "loved")} suggest={more} />
			<SteerWell steer={steer} group="disliked" slots={phone ? 2 : 3} onClear={() => clearSteer(d, "disliked")} suggest={less} />
		</section>
	)
	const match = (
		<section className="min-w-0">
			<Head>
				<FingerPrintIcon className="h-5 w-5 text-amber-500" aria-hidden />
				<h4 className="text-[14px] font-semibold text-gray-100">Taste match</h4>
				{member && <span className="text-[12px] text-gray-500">From your {MEMBER_RATINGS} scores</span>}
			</Head>
			{member ? <MemberMatch d={d} /> : <SignUpBlock items={SIGN_UP_ITEMS} />}
		</section>
	)
	if (phone)
		return (
			<div className="space-y-6">
				{add}
				{wells}
				{match}
			</div>
		)
	return (
		<div className="grid h-full grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.95fr)] gap-8 px-7 py-5">
			{add}
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{wells}</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{match}</div>
		</div>
	)
}
