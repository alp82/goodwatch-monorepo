// PROTOTYPE (start page lab): hero d, bolder, ask the room: the search sits on the room itself (its calm top area,
// over a scrim), and an answer lands on the shelves one slot after another, with a plain row of cards under the room.
import { useCallback, useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { type LabCard, useLab } from "../../lab/types"
import { CHIP, chipTone, ReadingLine, ResultRow, SearchField, SeeAll, useHeroSearch } from "./shared"

const LAND_MS = 110

/** Puts new titles on the shelves slot by slot, so the room visibly fills with the answer. */
function useLanding() {
	const { shelfTitles, setShelfTitles } = useLab()
	const reduce = useReducedMotion()
	const current = useRef(shelfTitles)
	current.current = shelfTitles
	const set = useRef(setShelfTitles)
	set.current = setShelfTitles
	const timers = useRef<ReturnType<typeof setTimeout>[]>([])
	const [landing, setLanding] = useState(false)
	useEffect(() => () => timers.current.forEach(clearTimeout), [])
	const land = useCallback(
		(cards: LabCard[]) => {
			timers.current.forEach(clearTimeout)
			timers.current = []
			if (reduce) return set.current(cards)
			const before = current.current
			setLanding(true)
			cards.forEach((_, i) => {
				timers.current.push(
					setTimeout(() => {
						const fresh = cards.slice(0, i + 1)
						const keys = new Set(fresh.map((c) => c.key))
						const last = i === cards.length - 1
						set.current(last ? cards : [...fresh, ...before.slice(i + 1).filter((c) => !keys.has(c.key))])
						if (last) setLanding(false)
					}, i * LAND_MS),
				)
			})
		},
		[reduce],
	)
	return { land, landing }
}

export function AskRoomHero() {
	const { Room, data } = useLab()
	const { land, landing } = useLanding()
	const { answer, search, prompt, clear } = useHeroSearch(land)
	const [draft, setDraft] = useState("")
	const prompts = data.guest.prompts.slice(0, 3)

	return (
		<section>
			<Room className="[&>div]:!absolute h-[70svh] min-h-[470px] w-full sm:h-[82vh] sm:max-h-[880px] sm:min-h-[560px]">
				{/* The scrim keeps the field legible over any scene; it never covers the lower room, so posters stay bright. */}
				<div className="pointer-events-none absolute inset-x-0 top-0 h-[52%] bg-linear-to-b from-gray-950/90 via-gray-950/60 to-transparent sm:h-[46%]" />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-gray-900 to-transparent" />
				<div className="pointer-events-none absolute inset-x-0 top-0">
					<div className="pointer-events-auto mx-auto max-w-3xl px-4 pt-5 sm:px-6 sm:pt-12">
						<h1 className="mb-1 text-sm font-semibold text-gray-300 [text-shadow:0_1px_8px_rgb(0_0_0/0.8)] sm:text-base">
							Ask the room for anything
						</h1>
						<SearchField
							value={draft}
							onChange={setDraft}
							onSubmit={search}
							onClear={answer ? clear : undefined}
							placeholder="What’s the mood?"
							size="small"
						/>
						<div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
							{prompts.map((p) => (
								<button
									key={p.q}
									type="button"
									onClick={() => {
										setDraft(p.q)
										prompt(p.q)
									}}
									className={`${CHIP} ${chipTone(answer?.q === p.q)} !h-8 !text-[13px]`}
								>
									{p.q}
								</button>
							))}
						</div>
						<p
							aria-live="polite"
							className={`mt-2.5 text-sm font-semibold text-amber-300 transition-opacity duration-300 [text-shadow:0_1px_8px_rgb(0_0_0/0.8)] ${answer ? "opacity-100" : "opacity-0"}`}
						>
							{answer ? (landing ? "Filling the shelves…" : "Your picks are on the shelves") : " "}
						</p>
					</div>
				</div>
			</Room>
			{answer ? (
				<div className="mx-auto max-w-7xl px-4 pt-3 pb-4 sm:px-6">
					<div className="mb-3 flex min-w-0 items-center gap-3">
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold text-gray-200">For “{answer.q}”</p>
							<ReadingLine answer={answer} className="mt-1" />
						</div>
						<SeeAll q={answer.q} className="-mr-3" />
					</div>
					<ResultRow cards={answer.titles} />
				</div>
			) : null}
		</section>
	)
}
