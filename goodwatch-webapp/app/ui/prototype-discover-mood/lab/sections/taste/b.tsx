// PROTOTYPE - throwaway. Your taste, match first: Taste match across the top (a guest sees the wide sign-up band),
// Loved and Disliked as two lanes underneath, and the titles to mark as a poster strip beside them.
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { useState } from "react"
import type { SectionProps } from "../../types"
import {
	ClearButton,
	Head,
	MatchScale,
	SIGN_UP_ITEMS,
	Shelf,
	SignUpBlock,
	SteerButtons,
	SteerLabel,
	Thumb,
	TitleField,
	type ViewAs,
	ViewAsToggle,
	clearSteer,
	listPicks,
	useSteer,
	useTitleSearch,
} from "./parts"

export function TasteB({ d, phone, text }: SectionProps) {
	const steer = useSteer(d)
	const [find, setFind] = useState(text)
	const [as, setAs] = useState<ViewAs>("guest")
	const { picks, loading } = useTitleSearch(find)
	const searching = find.trim().length >= 2
	const n = phone ? 8 : 6
	const list = searching ? picks.slice(0, n) : listPicks(d, n)

	const match = (
		<section>
			<Head right={<ViewAsToggle value={as} onChange={setAs} />}>
				<FingerPrintIcon className="h-5 w-5 text-amber-500" aria-hidden />
				<h4 className="text-[14px] font-semibold text-gray-100">Taste match</h4>
				{as === "member" && <span className="text-[12px] text-gray-500">From your ratings</span>}
			</Head>
			{as === "guest" ? <SignUpBlock layout={phone ? "panel" : "wide"} items={phone ? undefined : SIGN_UP_ITEMS} /> : <MatchScale d={d} />}
		</section>
	)
	const lanes = (
		<section className="min-w-0 space-y-3">
			{(["loved", "disliked"] as const).map((g) => {
				const count = g === "loved" ? steer.loved.length : steer.disliked.length
				return (
					<div key={g} className="flex min-w-0 items-center gap-4">
						<div className="w-[150px] shrink-0">
							<SteerLabel group={g} n={count} />
							{count > 0 && (
								<div className="mt-1 pl-7">
									<ClearButton onClick={() => clearSteer(d, g)} />
								</div>
							)}
						</div>
						<div className="min-w-0 flex-1">
							<Shelf steer={steer} group={g} slots={phone ? 4 : 6} size="sm" />
						</div>
					</div>
				)
			})}
		</section>
	)
	const strip = (
		<section className="min-w-0">
			<TitleField value={find} onChange={setFind} loading={loading} />
			<div className={`mt-3 flex gap-2.5 ${phone ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : ""}`} style={{ height: 136 }}>
				{list.length ? (
					list.map((t) => (
						<div key={t.key} className="flex w-[66px] shrink-0 flex-col items-center gap-1.5" title={`${t.title} ${t.year}`}>
							<Thumb t={t} className="h-[96px] w-[64px] rounded-lg" />
							<SteerButtons steer={steer} t={t} size="sm" />
						</div>
					))
				) : (
					<p className="self-center text-[13px] text-gray-500">{searching && !loading ? `No title called “${find.trim()}”` : ""}</p>
				)}
			</div>
		</section>
	)
	if (phone)
		return (
			<div className="space-y-6">
				{match}
				{strip}
				{lanes}
			</div>
		)
	return (
		<div className="flex h-full flex-col gap-5 px-7 py-5">
			{match}
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 border-t border-white/[0.06] pt-4">
				{lanes}
				{strip}
			</div>
		</div>
	)
}
