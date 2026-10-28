// PROTOTYPE - throwaway. Your taste baseline: find a title (or take one from the list) and mark it loved or disliked,
// the two shelves in the middle, Taste match on the right (a guest sees what it does and one Sign up).
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { useState } from "react"
import type { SectionProps } from "../../types"
import {
	ClearButton,
	Head,
	MatchScale,
	RowsLoading,
	SIGN_UP_ITEMS,
	Shelf,
	SignUpBlock,
	SteerLabel,
	SteerRow,
	TitleField,
	type ViewAs,
	ViewAsToggle,
	clearSteer,
	listPicks,
	useSteer,
	useTitleSearch,
} from "./parts"

export function TasteA({ d, phone, text }: SectionProps) {
	const steer = useSteer(d)
	const [find, setFind] = useState(text)
	const [as, setAs] = useState<ViewAs>("guest")
	const { picks, loading } = useTitleSearch(find)
	const searching = find.trim().length >= 2
	const rows = 4
	const list = searching ? picks.slice(0, rows) : listPicks(d, rows)

	const add = (
		<section className="min-w-0">
			<TitleField value={find} onChange={setFind} loading={loading} />
			<p className="mt-3 mb-1 px-2 text-[12px] text-gray-500">{searching ? `Titles called “${find.trim()}”` : "In this list"}</p>
			<div style={{ height: rows * 58 }}>
				{list.length ? (
					list.map((t) => <SteerRow key={t.key} steer={steer} t={t} />)
				) : searching && !loading ? (
					<p className="px-2 pt-2 text-[13px] text-gray-500">No title called “{find.trim()}”</p>
				) : (
					<RowsLoading n={rows} />
				)}
			</div>
		</section>
	)
	const shelves = (
		<section className="flex min-w-0 flex-col gap-5">
			{(["loved", "disliked"] as const).map((g) => {
				const n = g === "loved" ? steer.loved.length : steer.disliked.length
				return (
					<div key={g}>
						<Head right={n ? <ClearButton onClick={() => clearSteer(d, g)} /> : undefined}>
							<SteerLabel group={g} n={n} />
						</Head>
						<Shelf steer={steer} group={g} slots={phone ? 5 : 6} size={phone ? "sm" : "md"} />
					</div>
				)
			})}
		</section>
	)
	const match = (
		<section className="min-w-0">
			<Head right={<ViewAsToggle value={as} onChange={setAs} />}>
				<FingerPrintIcon className="h-5 w-5 text-amber-500" aria-hidden />
				<h4 className="text-[14px] font-semibold text-gray-100">Taste match</h4>
			</Head>
			{as === "guest" ? (
				<SignUpBlock items={SIGN_UP_ITEMS} />
			) : (
				<div className="space-y-3">
					<MatchScale d={d} tall />
					<p className="text-[12px] text-gray-500">From your ratings</p>
				</div>
			)}
		</section>
	)
	if (phone)
		return (
			<div className="space-y-6">
				{add}
				{shelves}
				{match}
			</div>
		)
	return (
		<div className="grid h-full grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.95fr)] gap-8 px-7 py-5">
			{add}
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{shelves}</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{match}</div>
		</div>
	)
}
