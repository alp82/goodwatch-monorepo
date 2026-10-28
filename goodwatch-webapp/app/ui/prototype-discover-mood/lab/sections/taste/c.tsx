// PROTOTYPE - throwaway. Your taste as a poster wall: the titles in this list (or the ones the field finds) as big
// posters with loved and disliked under each, what's marked collected in one line on top, Taste match as a slim strip
// at the bottom.
import { FingerPrintIcon, HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import type { SectionProps } from "../../types"
import {
	ClearButton,
	SignUpBlock,
	type Steer,
	SteerButtons,
	type SteerApi,
	Thumb,
	TitleField,
	listPicks,
	useSteer,
	useTitleSearch,
} from "./parts"
import { MemberMatch } from "./member"

function Marked({ steer, group }: { steer: SteerApi; group: Steer }) {
	const keys = group === "loved" ? steer.loved : steer.disliked
	const Icon = group === "loved" ? HandThumbUpIcon : HandThumbDownIcon
	return (
		<span className="flex min-w-0 items-center gap-2">
			<Icon className={`h-4 w-4 shrink-0 ${group === "loved" ? "text-emerald-400" : "text-rose-400"}`} aria-hidden />
			<span className="shrink-0 text-[13px] text-gray-300">{group === "loved" ? "More like" : "Less like"}</span>
			{keys.length === 0 ? (
				<span className="text-[13px] text-gray-600">Nothing yet</span>
			) : (
				<span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
					{keys.slice(0, 5).map((k) => {
						const t = steer.known(k)
						return (
							<button
								key={k}
								type="button"
								onClick={() => t && steer.set(t, null)}
								title={t ? `${t.title}: take off` : undefined}
								aria-label={t ? `Take ${t.title} off` : "Take off"}
								className={`shrink-0 rounded cursor-pointer outline-none ring-2 ${group === "loved" ? "ring-emerald-400/80" : "ring-rose-400/80"} focus-visible:ring-amber-400`}
							>
								<Thumb t={t} className="h-[33px] w-[22px] rounded" />
							</button>
						)
					})}
					{keys.length > 5 && <span className="text-[12px] text-gray-500">+{keys.length - 5}</span>}
				</span>
			)}
		</span>
	)
}

export function TasteC({ d, phone, text, viewer }: SectionProps) {
	const steer = useSteer(d)
	const [find, setFind] = useState(text)
	const as = viewer
	const { picks, loading } = useTitleSearch(find)
	const searching = find.trim().length >= 2
	const n = phone ? 10 : 11
	const list = searching ? picks.slice(0, n) : listPicks(d, n)
	const any = steer.loved.length + steer.disliked.length > 0

	const top = (
		<div className={`flex gap-x-6 gap-y-3 ${phone ? "flex-col" : "items-center"}`}>
			<div className={phone ? "" : "w-[340px] shrink-0"}>
				<TitleField value={find} onChange={setFind} loading={loading} />
			</div>
			<span className="shrink-0 text-[12px] text-gray-500">{searching ? `Titles called “${find.trim()}”` : "From this list"}</span>
			<div className={`flex min-w-0 gap-x-6 gap-y-2 ${phone ? "flex-col" : "ml-auto items-center"}`}>
				<Marked steer={steer} group="loved" />
				<Marked steer={steer} group="disliked" />
				{any && <ClearButton onClick={() => d.filters.set({ loved: undefined, disliked: undefined })} />}
			</div>
		</div>
	)
	const wall = (
		<div className={`flex gap-3 ${phone ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : "overflow-hidden"}`} style={{ height: 196 }}>
			{list.length ? (
				list.map((t) => {
					const at = steer.stateOf(t.key)
					return (
						<div key={t.key} className="flex w-[104px] shrink-0 flex-col items-center gap-2" title={`${t.title} ${t.year}`}>
							<span
								className={`block rounded-lg ring-offset-2 ring-offset-gray-950 transition-shadow ${at === "loved" ? "ring-2 ring-emerald-400" : at === "disliked" ? "ring-2 ring-rose-400" : ""}`}
							>
								<Thumb t={t} className={`h-[150px] w-[100px] rounded-lg transition-opacity ${at === "disliked" ? "opacity-50" : ""}`} />
							</span>
							<SteerButtons steer={steer} t={t} />
						</div>
					)
				})
			) : (
				<p className="self-center text-[13px] text-gray-500">{searching && !loading ? `No title called “${find.trim()}”` : ""}</p>
			)}
		</div>
	)
	const match = (
		<div className="flex items-center gap-3">
			<div className="min-w-0 flex-1">
				{as === "guest" ? (
					<SignUpBlock layout="strip" />
				) : (
					<div className="flex h-14 items-center gap-3">
						<FingerPrintIcon className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
						<span className="w-[96px] shrink-0 text-[14px] font-semibold text-gray-100">Taste match</span>
						<div className="min-w-0 flex-1">
							<MemberMatch d={d} compact />
						</div>
					</div>
				)}
			</div>
		</div>
	)
	return (
		<div className={phone ? "space-y-5" : "flex h-full flex-col gap-4 px-7 py-5"}>
			{top}
			{wall}
			{match}
		</div>
	)
}
