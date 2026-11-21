// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). The pantry: everything that can go into a blend,
// one family at a time, with a preview of what the blend would become. Every ingredient is a real link to the blend
// with it added; nothing is replaced. An ingredient that leaves only a handful is dimmed, one that leaves nothing is
// struck through.
import { Link, useFetcher } from "@remix-run/react"
import { CheckBadgeIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef, useState } from "react"
import { type Address, type Family, type Kind, add, best as bestAddress } from "../../kit/address"
import type { PlaceRef, ShowTitle } from "../../kit/types"
import { PlaceMark, poster } from "../../kit/ui"
import type { BlendData, PantryGroup, PantryOption } from "./loader.server"
import { PhraseText, idOf, nice, useDragSource } from "./parts"
import { FAMILY_WORD, phrase } from "./phrase"

type To = (a: Address, extra?: Record<string, string | undefined>) => string

function Option({
	option,
	to,
	onHot,
	hot,
}: {
	option: PantryOption
	to: string
	onHot: (p: PlaceRef | null) => void
	hot: boolean
}) {
	const { place, state } = option
	const drag = useDragSource(place)
	const mark = (
		<span
			className={`grid w-6 shrink-0 place-items-center ${state === "none" ? "opacity-40" : ""}`}
		>
			<PlaceMark place={place} size={15} />
		</span>
	)
	if (state === "none")
		return (
			<span className="flex min-h-9 items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] leading-tight text-gray-600 line-through decoration-gray-700">
				{mark}
				<span>{nice(place)}</span>
			</span>
		)
	return (
		<Link
			to={to}
			prefetch="intent"
			{...drag}
			onPointerEnter={(e) => e.pointerType === "mouse" && onHot(place)}
			onFocus={() => onHot(place)}
			className={`flex min-h-9 items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] leading-tight font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${hot ? "bg-white/[0.12] text-white" : state === "thin" ? "text-gray-400 hover:bg-white/[0.08] hover:text-gray-100" : "text-gray-200 hover:bg-white/[0.08] hover:text-white"}`}
		>
			{mark}
			<span>{nice(place)}</span>
		</Link>
	)
}

export function Pantry({
	kind,
	address,
	parts,
	isBest,
	year,
	groups,
	to,
}: {
	kind: Kind
	address: Address
	parts: PlaceRef[]
	isBest: boolean
	year?: number | null
	groups: PantryGroup[]
	to: To
}) {
	const [family, setFamily] = useState<Family>(groups[0]?.family ?? "mood")
	const [hot, setHot] = useState<PlaceRef | null>(null)
	const [seen, setSeen] = useState<Record<string, ShowTitle[]>>({})
	const fetcher = useFetcher<{ data?: BlendData }>()
	const asked = useRef<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const group = groups.find((g) => g.family === family) ?? groups[0]

	// The first ingredient of a family is previewed as soon as the family opens, so the pane is never empty.
	useEffect(() => {
		const first = group?.options.find((o) => o.state === "full")?.place ?? null
		setHot(first)
	}, [group])

	useEffect(() => {
		if (!hot || seen[idOf(hot)]) return
		clearTimeout(timer.current)
		timer.current = setTimeout(() => {
			asked.current = idOf(hot)
			fetcher.load(to(add(address, hot), { peek: "1" }))
		}, 110)
		return () => clearTimeout(timer.current)
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- asks once per ingredient
	}, [hot])

	useEffect(() => {
		const data = fetcher.data?.data
		if (fetcher.state !== "idle" || !asked.current || data?.view !== "peek") return
		const key = asked.current
		setSeen((s) => (s[key] ? s : { ...s, [key]: data.titles }))
	}, [fetcher.state, fetcher.data])

	if (!group) return null
	const preview = hot ? seen[idOf(hot)] : undefined
	const becomes = hot
		? phrase(kind, [...parts, hot], { best: isBest, year: year ?? undefined })
		: null
	const tab = (g: PantryGroup) => (
		<button
			key={g.family}
			type="button"
			role="tab"
			aria-selected={g.family === family}
			onClick={() => setFamily(g.family)}
			onPointerEnter={(e) => e.pointerType === "mouse" && setFamily(g.family)}
			className={`flex h-9 shrink-0 items-center rounded-lg px-3 text-left text-[15px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:w-full ${
				g.family === family ? "bg-white/[0.12] text-white" : "text-gray-400 hover:text-white"
			}`}
		>
			{FAMILY_WORD[g.family]}
		</button>
	)
	const bestLink = (layout: string) =>
		!isBest && (
			<Link
				to={to(bestAddress(kind, address.parts))}
				prefetch="intent"
				className={`h-10 items-center gap-1.5 rounded-lg px-3 text-[15px] font-bold whitespace-nowrap text-gray-300 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${layout}`}
			>
				<CheckBadgeIcon className="h-4 w-4 text-amber-400" />
				Only the best
			</Link>
		)
	return (
		<div className="grid sm:grid-cols-[10.5rem_minmax(0,1fr)_15rem]">
			<div className="flex min-w-0 flex-col sm:border-r sm:border-white/10 sm:p-3">
				<p className="px-4 pt-2 pb-1 font-display text-lg font-bold text-white sm:hidden">
					Add an ingredient
				</p>
				<div
					role="tablist"
					aria-label="Kinds of ingredient"
					className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:flex-col sm:overflow-visible sm:p-0"
				>
					{groups.map(tab)}
				</div>
				{bestLink("mt-auto hidden border-t border-white/10 pt-1 sm:flex")}
			</div>
			<div
				role="tabpanel"
				className="max-h-[46vh] min-w-0 overflow-y-auto px-3 pb-3 sm:max-h-none sm:min-h-[22rem] sm:p-3"
			>
				{(
					[
						["full", null],
						["thin", "Only a handful with these"],
						["none", "Nothing with these"],
					] as const
				).map(([state, caption]) => {
					const options = group.options.filter((o) => o.state === state)
					if (!options.length) return null
					return (
						<div key={state}>
							{caption && (
								<p className="mt-3 mb-1 border-t border-white/10 px-2 pt-3 text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
									{caption}
								</p>
							)}
							<div className="grid grid-cols-2 content-start gap-x-2 gap-y-0.5 sm:grid-cols-3">
								{options.map((o) => (
									<Option
										key={o.place.slug}
										option={o}
										to={to(add(address, o.place))}
										onHot={setHot}
										hot={!!hot && idOf(hot) === idOf(o.place)}
									/>
								))}
							</div>
						</div>
					)
				})}
				{bestLink("mt-3 flex border-t border-white/10 pt-2 sm:hidden")}
			</div>
			<div className="hidden border-l border-white/10 bg-black/20 p-4 sm:block">
				<p className="text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
					You&rsquo;d get
				</p>
				{becomes && (
					<p className="mt-1 min-h-[3.6rem] font-display text-lg leading-snug font-bold text-balance text-white">
						<PhraseText segs={becomes} />
					</p>
				)}
				<div className="mt-2 grid grid-cols-2 gap-2">
					{[0, 1, 2, 3].map((i) => {
						const t = preview?.[i]
						return (
							<span
								key={t?.card.key ?? `empty-${i}`}
								className="block aspect-[2/3] overflow-hidden rounded-md bg-white/[0.05] ring-1 ring-white/10"
							>
								{t?.card.poster_path && (
									<img
										src={poster(t.card.poster_path, "w185")}
										alt={t.card.title}
										ref={(el) => {
											if (!el || el.dataset.in) return
											el.dataset.in = "1"
											el.animate([{ opacity: 0 }, { opacity: 1 }], {
												duration: 220,
												easing: "ease-out",
											})
										}}
										className="h-full w-full object-cover"
									/>
								)}
							</span>
						)
					})}
				</div>
			</div>
		</div>
	)
}
