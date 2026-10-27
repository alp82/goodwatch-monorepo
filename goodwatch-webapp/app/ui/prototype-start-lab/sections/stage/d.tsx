// PROTOTYPE (start page lab, round 2): stage d "Side by side": on desktop the room fills the stage; a left column over
// a gradient holds the H1, a big field, the moods as a rich list and the results in a fixed-height scroll area; a fixed
// "Your three" column on the right fills as the guest taps loved titles, then shows the picks. Phones stack it, with a
// sticky "Your three" bar that opens the picks in a sheet.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import type { BlockVariant, LabCard } from "../../lab/types"
import { useLab } from "../../lab/types"
import { ReadingLine, SearchField, discoverHref } from "../hero/shared"
import { KeepNudge, joinNames } from "../recs/shared"
import { CD_KEYFRAMES, HeartBadge, LoveCard, MoodFan, ReadingWait, SkeletonCard } from "./cd-parts"
import { NEED, type StageState, useMoods, useStage } from "./cd-state"

/** Phones show two rows of three; the place is held even when a search has fewer. */
const PHONE_CARDS = 6

function SideBySide() {
	const { Room } = useLab()
	const st = useStage("d")
	const [sheet, setSheet] = useState(false)

	// Three loved: the picks open on a phone (not when they come back from a kept session).
	const wasDone = useRef<boolean | null>(null)
	useEffect(() => {
		if (!st.ready) return
		if (wasDone.current === false && st.done && !window.matchMedia("(min-width: 1024px)").matches) setSheet(true)
		wasDone.current = st.done
	}, [st.ready, st.done])

	return (
		<section aria-label="Search and picks" className="relative bg-gray-950 lg:h-[calc(100svh-65px)] lg:min-h-[660px] lg:overflow-hidden">
			<style>{CD_KEYFRAMES}</style>
			<Room noTv posters={st.done ? st.picks : st.results} style={{ position: "absolute" }} className="inset-x-0 top-0 h-[560px] lg:h-full" />
			{/* Phones: the room fades into the page under the field. Desktop: dark at the sides, the room open between. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-[562px] lg:hidden"
				style={{ background: "linear-gradient(to bottom, rgb(3 7 18 / .78) 0%, rgb(3 7 18 / .7) 40%, rgb(3 7 18) 100%)" }}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 hidden lg:block"
				style={{
					background:
						"linear-gradient(to right, rgb(3 7 18 / .96) 0%, rgb(3 7 18 / .9) 38%, rgb(3 7 18 / .55) 50%, rgb(3 7 18 / 0) 62%, rgb(3 7 18 / 0) 66%, rgb(3 7 18 / .88) 77%, rgb(3 7 18 / .96) 100%)",
				}}
			/>
			<LeftColumn st={st} />
			<YourThree st={st} />
			<PhoneBar st={st} onOpen={() => setSheet(true)} />
			<PhoneSheet st={st} open={sheet} onClose={() => setSheet(false)} />
		</section>
	)
}

function LeftColumn({ st }: { st: StageState }) {
	const moods = useMoods()
	const activeMood = st.src?.kind === "mood" ? st.src.v : null
	const prompt = st.data.guest.prompts[0]
	const scroller = useRef<HTMLDivElement>(null)
	const sig = st.results.map((c) => c.key).join(",")
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the cards
	useEffect(() => {
		scroller.current?.scrollTo({ top: 0 })
	}, [sig])

	return (
		<div className="relative flex flex-col px-4 pt-4 lg:absolute lg:inset-y-0 lg:left-0 lg:w-[min(740px,54%)] lg:pt-8 lg:pr-6 lg:pb-6 lg:pl-10 xl:pl-14">
			<h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-white lg:text-[28px]">
				Find something to watch by mood or anything
			</h1>
			<div className="mt-1 lg:mt-2">
				<SearchField value={st.draft} onChange={st.setDraft} onSubmit={(v) => st.typed(v)} onClear={st.clear} placeholder="A mood, a title, anything" />
			</div>

			{/* Moods as a rich list: phones scroll two rows sideways, desktop shows a 3-column list. */}
			<h2 className="sr-only">Moods</h2>
			<div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:mt-4 lg:overflow-visible lg:px-0">
				<div className="grid w-max auto-cols-[188px] grid-flow-col grid-rows-2 gap-1.5 lg:w-auto lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-3 lg:grid-rows-none">
					{moods.map((m) => (
						<MoodRow
							key={m.key}
							on={activeMood === m.key}
							onClick={() => st.mood(m.key)}
							titles={m.titles}
							hue={m.hue}
							name={m.name}
							line={m.examples}
						/>
					))}
					{prompt ? (
						<MoodRow
							on={st.src?.kind === "prompt" && st.src.v === prompt.q}
							onClick={() => st.prompt(prompt.q)}
							titles={prompt.titles}
							hue="#fbbf24"
							name="Try asking"
							line={`“${prompt.q}”`}
							italic
						/>
					) : null}
				</div>
			</div>

			{/* The results: a fixed place from the first paint; the loading moment and the answer swap inside it. */}
			<div className="mt-4 flex h-8 min-w-0 shrink-0 items-center gap-3">
				<div className="min-w-0 flex-1">
					{st.pending ? (
						st.pending.reading ? (
							<ReadingLine answer={{ q: st.pending.q, answeredAs: st.pending.q, kind: "prompt", reading: st.pending.reading, titles: [] }} />
						) : (
							<ReadingWait q={st.pending.q} />
						)
					) : st.answer ? (
						<ReadingLine answer={st.answer} />
					) : (
						<h2 className="truncate text-sm text-gray-300">
							<span className="text-xs font-extrabold tracking-[0.16em] text-gray-200 uppercase">Popular now</span>
							<span className="hidden sm:inline"> · tap three you loved</span>
						</h2>
					)}
				</div>
				{st.answer && !st.pending ? (
					<Link to={discoverHref(st.answer.q)} prefetch="none" className="shrink-0 text-sm font-semibold text-amber-400 hover:text-amber-300">
						See all <span aria-hidden>→</span>
					</Link>
				) : null}
			</div>
			<div
				ref={scroller}
				className="mt-2 lg:-mr-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-3 lg:[scrollbar-color:rgb(75_85_99)_transparent] lg:[scrollbar-width:thin]"
			>
				<div key={st.pending ? "wait" : sig} className="grid grid-cols-3 gap-2 pb-2 sm:gap-3 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5">
					{st.pending
						? // biome-ignore lint/suspicious/noArrayIndexKey: placeholders
							Array.from({ length: 15 }, (_, i) => <SkeletonCard key={i} i={i} className={i >= PHONE_CARDS ? "hidden lg:block" : ""} />)
						: [
								...st.results.map((card, i) => (
									<div
										key={card.key}
										className={`animate-[cd-in_.3s_ease-out_both] ${i >= PHONE_CARDS ? "hidden lg:block" : ""}`}
										style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}
									>
										<LoveCard
											card={card}
											loved={st.lovedKeys.has(card.key)}
											onLove={st.done ? undefined : () => st.toggleLove(card)}
											full={st.loved.length >= NEED}
											priority={i < 6}
										/>
									</div>
								)),
								// Fewer than six: hold the phone's two rows anyway.
								...Array.from({ length: Math.max(0, PHONE_CARDS - st.results.length) }, (_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
									<div key={`hold-${i}`} aria-hidden className="invisible aspect-[2/3] lg:hidden" />
								)),
							]}
				</div>
			</div>
		</div>
	)
}

function MoodRow({
	on,
	onClick,
	titles,
	hue,
	name,
	line,
	italic,
}: {
	on: boolean
	onClick: () => void
	titles: LabCard[]
	hue: string
	name: string
	line: string
	italic?: boolean
}) {
	const [hover, setHover] = useState(false)
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
			onPointerLeave={() => setHover(false)}
			className={`flex h-[46px] min-w-0 cursor-pointer items-center gap-2 rounded-lg pr-2.5 pl-1 text-left outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white/[0.12] ring-amber-400" : "bg-gray-950/40 ring-white/[0.07] hover:bg-white/[0.07]"}`}
			style={{ backgroundImage: `linear-gradient(90deg, ${hue}2e 0%, ${hue}00 65%)` }}
		>
			<MoodFan titles={titles} hue={hue} spread={on || hover} className="h-[36px] w-[52px] shrink-0" poster="w-[21px]" />
			<span className="min-w-0 flex-1">
				<span className={`flex items-center gap-1.5 text-[13px] leading-4 font-semibold ${on ? "text-white" : "text-gray-100"}`}>
					<span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: hue }} />
					<span className="truncate">{name}</span>
				</span>
				<span className={`mt-0.5 block truncate text-[11px] leading-4 text-gray-400 ${italic ? "italic" : ""}`}>{line}</span>
			</span>
		</button>
	)
}

/** Desktop: the fixed right column. Three frames fill with the taps; then the picks, in the same place. */
function YourThree({ st }: { st: StageState }) {
	return (
		<aside className="absolute inset-y-0 right-0 hidden w-[300px] flex-col px-6 pt-8 pb-6 lg:flex xl:w-[348px] xl:pr-10">
			<h2 className="text-xs font-extrabold tracking-[0.16em] text-amber-400 uppercase">{st.done ? "Picked for you" : "Your three"}</h2>
			<p className="mt-1 h-10 text-sm leading-5 text-gray-300" aria-live="polite">
				{st.done ? (
					<span className="line-clamp-2">
						Because you loved <b className="text-white">{joinNames(st.loved)}</b>
					</span>
				) : st.loved.length === 0 ? (
					"Tap three titles you loved in the results, then get picks for your taste."
				) : (
					`${st.loved.length} of ${NEED}. ${NEED - st.loved.length} more for your picks.`
				)}
			</p>
			<Frames st={st} className="mt-3" />
			<div className="relative mt-5 min-h-0 flex-1">
				{/* Before the picks: their place, faint. */}
				<div
					aria-hidden
					className="absolute inset-0 grid grid-cols-2 content-start gap-2.5 transition-opacity duration-300"
					style={{ opacity: st.done ? 0 : 1 }}
				>
					{Array.from({ length: 4 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
						<div key={i} className="aspect-[2/3] rounded-md border border-dashed border-white/10 bg-white/[0.02]" />
					))}
					<p className="col-span-2 mt-1 text-center text-xs text-gray-500">Your picks show here</p>
				</div>
				{st.done ? (
					<div className="absolute inset-0 flex animate-[cd-fade_.35s_ease-out] flex-col">
						<div className="-mr-3 min-h-0 flex-1 overflow-y-auto pr-3 [scrollbar-color:rgb(75_85_99)_transparent] [scrollbar-width:thin]">
							<div className="grid grid-cols-2 gap-2.5 pb-2">
								{st.picks.map((card, i) => (
									<div key={card.key} className="animate-[cd-in_.3s_ease-out_both]" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
										<TitlePosterCard card={card} actions={false} />
									</div>
								))}
							</div>
						</div>
						<div className="shrink-0 pt-3">
							<KeepNudge />
							<button type="button" onClick={st.restart} className="mt-2 text-sm font-semibold text-gray-400 hover:text-white">
								Start over
							</button>
						</div>
					</div>
				) : null}
			</div>
		</aside>
	)
}

/** Three poster frames: empty and numbered, then the loved titles (a tap takes one out again). */
function Frames({ st, className = "", size = "lg" }: { st: StageState; className?: string; size?: "lg" | "sm" }) {
	const small = size === "sm"
	return (
		<div className={`grid grid-cols-3 ${small ? "w-[86px] gap-1" : "gap-2.5"} ${className}`}>
			{Array.from({ length: NEED }, (_, i) => {
				const c = st.loved[i]
				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: three fixed frames
						key={i}
						className={`relative aspect-[2/3] overflow-hidden ${small ? "rounded-[3px]" : "rounded-md"} ${c ? "ring-2 ring-amber-400" : "border border-dashed border-white/25 bg-gray-950/50"}`}
					>
						{!c && !small ? (
							<span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white/25">{i + 1}</span>
						) : null}
						{c && small ? (
							<img key={c.key} src={tmdbImage(c.poster_path, "w185")} alt="" className="absolute inset-0 h-full w-full animate-[cd-in_.25s_ease-out_both] object-cover" />
						) : c ? (
							<button
								type="button"
								key={c.key}
								disabled={st.done}
								onClick={() => st.toggleLove(c)}
								aria-label={`${c.title}: take it out`}
								className="group absolute inset-0 animate-[cd-in_.25s_ease-out_both] disabled:cursor-default"
							>
								<img src={tmdbImage(c.poster_path, "w185")} alt="" className="h-full w-full object-cover" />
								<HeartBadge on size="sm" className="absolute left-1 top-1" />
								{st.done ? null : (
									<span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gray-950/80 py-1 text-[11px] font-semibold text-gray-200 opacity-0 transition-opacity group-hover:opacity-100">
										<XMarkIcon className="h-3 w-3" /> Take out
									</span>
								)}
							</button>
						) : null}
					</div>
				)
			})}
		</div>
	)
}

/** Phones: sticky at the foot of the stage, above the site's bottom bar. */
function PhoneBar({ st, onOpen }: { st: StageState; onOpen: () => void }) {
	return (
		<div className="pointer-events-none sticky bottom-[84px] z-40 mt-3 px-4 pb-3 lg:hidden">
			<button
				type="button"
				onClick={onOpen}
				disabled={!st.done}
				className="pointer-events-auto flex h-14 w-full items-center gap-3 rounded-xl bg-gray-900 px-3 text-left shadow-lg shadow-black/60 ring-1 ring-white/10 disabled:cursor-default"
			>
				<Frames st={st} size="sm" />
				<span className="min-w-0 flex-1" aria-live="polite">
					<span className="block text-sm font-semibold text-white">
						{st.done ? "Picked for you" : `Your three · ${st.loved.length} of ${NEED}`}
					</span>
					<span className="block truncate text-xs text-gray-400">
						{st.done ? `Because you loved ${joinNames(st.loved)}` : "Tap titles you loved for picks"}
					</span>
				</span>
				<span
					className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${st.done ? "bg-amber-400 text-gray-950" : "bg-white/[0.06] text-gray-500"}`}
				>
					Picks
				</span>
			</button>
		</div>
	)
}

/** Phones: the picks in a sheet that slides up. Transform and opacity only, no blur. */
function PhoneSheet({ st, open, onClose }: { st: StageState; open: boolean; onClose: () => void }) {
	useEffect(() => {
		if (!open) return
		const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", esc)
		return () => window.removeEventListener("keydown", esc)
	}, [open, onClose])
	return (
		<div className="lg:hidden" aria-hidden={!open}>
			<div
				className="fixed inset-0 z-[1100] bg-black/70 transition-opacity duration-300"
				style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
				onClick={onClose}
				onKeyDown={undefined}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Picked for you"
				className="fixed inset-x-0 bottom-0 z-[1101] flex h-[82svh] flex-col rounded-t-2xl bg-gray-900 shadow-2xl ring-1 ring-white/10 transition-transform duration-300 ease-out will-change-transform"
				style={{ transform: open ? "translateY(0)" : "translateY(105%)", visibility: open ? "visible" : "hidden", transitionProperty: "transform, visibility" }}
			>
				<div className="flex shrink-0 items-start gap-3 px-4 pt-4 pb-3">
					<div className="min-w-0 flex-1">
						<h2 className="text-xs font-extrabold tracking-[0.16em] text-amber-400 uppercase">Picked for you</h2>
						<p className="mt-1 text-sm text-gray-200">
							Because you loved <b className="text-white">{joinNames(st.loved)}</b>
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-white/10"
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-4">
					<div className="grid grid-cols-3 gap-2 pb-3">
						{st.picks.map((card) => (
							<TitlePosterCard key={card.key} card={card} actions={false} />
						))}
					</div>
				</div>
				<div className="shrink-0 border-t border-white/10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<KeepNudge />
					<button
						type="button"
						onClick={() => {
							st.restart()
							onClose()
						}}
						className="mt-2 text-sm font-semibold text-gray-400 hover:text-white"
					>
						Start over
					</button>
				</div>
			</div>
		</div>
	)
}

export const variant: BlockVariant = { key: "d", name: "Side by side", C: SideBySide }
