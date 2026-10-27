// PROTOTYPE (start page lab, round 4): what stage h and i share: stage e's shell and search block (shadow pool, lifted
// field) with the round 4 fixes: example prompts as real pill buttons, the moods in one row ending in More moods,
// posters that are the "loved it" toggles (ring, heart, lift; a small info button opens the title), and the step line.
import { Link } from "@remix-run/react"
import { HeartIcon, InformationCircleIcon, MagnifyingGlassIcon, Squares2X2Icon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useRef } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { titleHref } from "../../lab/kit"
import { type LabCard, useLab } from "../../lab/types"
import { moodHue, NEED, type StageFlow, useMoodFaces, useStageFlow } from "./ab-shared"
import { EfgFan, EfgField, NIGHT } from "./efg-shared"
import { pushRecent, ROW_MOODS, VOCAB, type VocabItem, vocabOf } from "./hi-vocab"

const POOL = [
	"radial-gradient(ellipse 34% 30% at 50% 42%, rgb(2 4 10 / .55), rgb(2 4 10 / 0) 100%)",
	"radial-gradient(ellipse 50% 46% at 50% 45%, rgb(2 4 10 / .82) 0%, rgb(2 4 10 / .66) 40%, rgb(2 4 10 / .34) 68%, rgb(2 4 10 / .1) 88%, rgb(2 4 10 / 0) 100%)",
].join(", ")

const FIELD_SHADOW =
	"0 1px 0 rgb(255 255 255 / .06) inset, 0 2px 4px rgb(0 0 0 / .45), 0 10px 22px rgb(0 0 0 / .45), 0 28px 56px rgb(0 0 0 / .55), 0 60px 120px rgb(0 0 0 / .55)"

const CSS = `@keyframes ab-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ab-in{animation:ab-in .35s cubic-bezier(.2,.8,.2,1) both}
.efg-glow{opacity:0;transition:opacity .25s ease-out}
.efg-field:focus-within .efg-glow{opacity:1}
.efg-fan-card{transform:translateX(calc(-50% + var(--x))) rotate(var(--r));transition:transform .35s cubic-bezier(.2,.8,.2,1)}
@media (hover:hover){.efg-fan-host:hover .efg-fan-card{transform:translateX(calc(-50% + var(--x2))) translateY(var(--y2)) rotate(var(--r2))}}
.efg-fan-host:focus-visible .efg-fan-card,.efg-fan-host[aria-pressed=true] .efg-fan-card{transform:translateX(calc(-50% + var(--x2))) translateY(var(--y2)) rotate(var(--r2))}
.efg-lift{transition:transform .25s cubic-bezier(.2,.8,.2,1)}
@media (hover:hover){.efg-lift:hover{transform:translateY(-3px)}}
.efg-lift:active{transform:scale(.97)}
.hi-pill{transition:transform .15s ease-out,background-color .15s,color .15s,box-shadow .15s}
.hi-pill:active{transform:scale(.95)}
.hi-lift{position:relative;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out}
@media (hover:hover){.hi-tog:not(.hi-off):hover .hi-lift{transform:translateY(-3px)}}
.hi-tog:not(.hi-off):active .hi-lift{transform:scale(.96)}
.hi-on .hi-lift,.hi-on:hover .hi-lift{transform:translateY(-6px)}
.hi-off .hi-lift{opacity:.4}
.hi-ring{position:absolute;inset:-4px;border-radius:12px;border:3px solid #fbbf24;box-shadow:0 0 18px rgb(251 191 36/.5);opacity:0;transform:scale(1.06);transition:opacity .18s ease-out,transform .25s cubic-bezier(.2,1.4,.4,1);pointer-events:none;z-index:32}
.hi-on .hi-ring{opacity:1;transform:none}
.hi-badge{position:absolute;right:-7px;top:-7px;z-index:33;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#fbbf24;color:#111827;box-shadow:0 3px 10px rgb(0 0 0/.5);opacity:0;transform:scale(.4);transition:opacity .15s ease-out,transform .3s cubic-bezier(.2,1.5,.4,1);pointer-events:none}
.hi-on .hi-badge{opacity:1;transform:none}
.hi-tap{position:absolute;inset:0;z-index:30;border-radius:8px;cursor:pointer;outline:none}
.hi-tap:focus-visible{box-shadow:0 0 0 2px #fbbf24}
.hi-info{transition:opacity .15s ease-out}
@media (hover:hover){.hi-info{opacity:0}.hi-tog:hover .hi-info,.hi-info:focus-visible{opacity:1}}
@keyframes hi-pop{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
@media (min-width:1024px) and (max-height:820px){.hi-top{padding-top:28px!important}.hi-h1{font-size:42px!important}.hi-field-gap{margin-top:20px!important}.hi-gap{margin-top:14px!important}.hi-ex{display:none!important}}`

/** The stage: stage e's shell (scene pushed below the search, night above), with the tray given by the variant. */
export function HiStage({
	k,
	top,
	tray,
	overlays,
}: {
	k: string
	top: (f: StageFlow) => ReactNode
	tray: (f: StageFlow) => ReactNode
	overlays?: (f: StageFlow) => ReactNode
}) {
	const { Room } = useLab()
	const f = useStageFlow(k)
	return (
		<section
			aria-label="Find something to watch"
			className="relative isolate overflow-hidden [container-type:inline-size] [--room-top:110px] sm:[--room-top:140px] lg:[--room-top:200px]"
			style={{ background: NIGHT }}
		>
			<style>{CSS}</style>
			<Room noTv focal={[0.5, 0.9]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: "var(--room-top)" }} />
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					background: `linear-gradient(to bottom, ${NIGHT} 0, ${NIGHT} var(--room-top), rgb(5 10 22 / 0) calc(var(--room-top) + 18vh)), linear-gradient(to bottom, rgb(3 7 18 / 0) 60%, rgb(3 7 18 / .4) 80%, rgb(3 7 18 / .9) 100%)`,
				}}
			/>
			<div className="pointer-events-none relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[1360px] flex-col px-4 pb-16 sm:px-6 sm:pb-[72px]">
				{top(f)}
				<div className="min-h-4 flex-1" />
				{tray(f)}
			</div>
			{overlays?.(f)}
		</section>
	)
}

/** H1, the lifted field, the example prompts and the mood row. `moreSlot` renders under the row (a popover). */
export function HiTop({ f, onMore, moreOpen, moreSlot }: { f: StageFlow; onMore: () => void; moreOpen: boolean; moreSlot?: ReactNode }) {
	return (
		<div className="hi-top relative isolate z-20 pt-3 sm:pt-12 lg:pt-[clamp(40px,8vh,96px)]">
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 -top-24 -z-10 h-[calc(100%+260px)] w-[230%] -translate-x-1/2 sm:w-[min(1700px,170%)]"
				style={{ background: POOL }}
			/>
			<h1 className="hi-h1 pointer-events-auto text-center text-[26px] font-extrabold leading-8 tracking-tight text-white [text-shadow:0_2px_4px_rgb(0_0_0/.6),0_8px_40px_rgb(0_0_0/.85)] sm:text-5xl sm:leading-[1.1] lg:text-[52px] 2xl:text-[56px]">
				Find something to watch by mood or anything
			</h1>
			<EfgField
				f={f}
				className="hi-field-gap mt-4 max-w-[880px] sm:mt-9"
				body="h-[62px] rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:h-[84px] sm:rounded-[22px] lg:h-[88px]"
				decor={<span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[22px]" style={{ boxShadow: FIELD_SHADOW }} />}
				glow="rounded-2xl ring-2 ring-amber-400/80 shadow-[0_0_0_6px_rgb(251_191_36/.12),0_0_70px_10px_rgb(251_191_36/.28)] sm:rounded-[22px]"
			/>
			<HiPrompts f={f} className="hi-gap mt-3 sm:mt-5" />
			<div className="hi-gap relative mt-3 sm:mt-6">
				<MoodRow f={f} onMore={onMore} moreOpen={moreOpen} />
				{moreSlot}
			</div>
		</div>
	)
}

/** Example prompts as pill buttons: a "Try" tag, a search icon, hover and press states. One line, scrolls on phones. */
export function HiPrompts({ f, className = "" }: { f: StageFlow; className?: string }) {
	const prompts = f.data.guest.prompts.slice(0, 3)
	const on = f.source.kind === "prompt" ? f.source.q : null
	return (
		<div className={`pointer-events-auto -mx-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] ${className}`}>
			<div className="mx-auto flex w-max items-center gap-2 text-sm sm:gap-2.5 sm:text-[15px]">
				<span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 sm:text-xs">Try</span>
				{prompts.map((p) => {
					const active = on === p.q
					return (
						<button
							key={p.q}
							type="button"
							onClick={() => (active ? f.clear() : f.prompt(p.q))}
							aria-pressed={active}
							className={`hi-pill inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full pr-3.5 pl-2.5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-10 sm:pr-4 sm:pl-3 ${active ? "bg-amber-400 text-gray-950 shadow-[0_6px_20px_rgb(251_191_36/.3)]" : "bg-gray-900/90 text-gray-100 ring-1 ring-white/15 shadow-[0_6px_18px_rgb(0_0_0/.5)] can-hover:hover:bg-gray-800 can-hover:hover:text-white can-hover:hover:ring-amber-400/50"}`}
						>
							<MagnifyingGlassIcon className={`h-4 w-4 shrink-0 ${active ? "text-gray-950" : "text-amber-400"}`} aria-hidden />
							{p.q}
						</button>
					)
				})}
			</div>
		</div>
	)
}

const TILE = "w-[112px] sm:w-[132px] lg:w-[128px] xl:w-[150px]"

/** The most common moods in one row, ending with More moods (sticky at the right edge while the row scrolls). */
export function MoodRow({ f, onMore, moreOpen }: { f: StageFlow; onMore: () => void; moreOpen: boolean }) {
	const moods = f.data.guest.moods
	const faces = useMoodFaces(moods)
	const row = ROW_MOODS.flatMap((k) => moods.find((m) => m.key === k) ?? [])
	const moodOn = f.source.kind === "mood" ? f.source.key : null
	const chosen = vocabOf(f.source)
	// A choice from More moods that the row doesn't show: the More tile names it.
	const chosenElsewhere = chosen && !(chosen.moodKey && ROW_MOODS.includes(chosen.moodKey)) ? chosen : null
	const rest = VOCAB.length - row.length
	return (
		<div className="pointer-events-auto -mx-4 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
			<ul className="flex w-max gap-2.5 lg:mx-auto lg:gap-3">
				{row.map((m) => {
					const on = moodOn === m.key
					const hue = moodHue(m.key)
					return (
						<li key={m.key}>
							<button
								type="button"
								onClick={() => (on ? f.clear() : f.mood(m.key))}
								aria-pressed={on}
								className={`efg-fan-host efg-lift flex ${TILE} cursor-pointer flex-col items-center rounded-2xl px-2 pt-2.5 pb-2 text-center shadow-[0_10px_30px_rgb(0_0_0/.45)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:px-2.5 sm:pt-3 sm:pb-2.5 ${on ? "bg-gray-900 ring-2 ring-amber-400" : "bg-gray-950/90 ring-1 ring-white/10 hover:bg-gray-900"}`}
								style={{ backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 40%, ${hue}${on ? "70" : "40"}, transparent 75%)` }}
							>
								<EfgFan cards={faces[m.key]?.fan ?? []} size={30} className="sm:hidden" />
								<EfgFan cards={faces[m.key]?.fan ?? []} size={42} className="hidden sm:block" />
								<span className="mt-1.5 flex max-w-full items-center gap-1.5 text-sm font-bold leading-5 text-white sm:mt-2 sm:text-[15px]">
									<span className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5" style={{ background: hue }} />
									<span className="truncate">{m.label}</span>
								</span>
								<span className="hi-ex mt-0.5 block w-full truncate text-[11px] leading-4 text-gray-400 sm:text-xs">{faces[m.key]?.examples}</span>
							</button>
						</li>
					)
				})}
				<li className="sticky right-0 z-10 -my-1 -mr-4 flex py-1 pr-4 pl-3 sm:-mr-6 sm:pr-6 [background:linear-gradient(to_right,transparent,rgb(5_10_22/.95)_14px)] lg:static lg:mr-0 lg:pr-0 lg:pl-0 lg:[background:none]">
					<button
						type="button"
						onClick={onMore}
						data-hi-more=""
						aria-expanded={moreOpen}
						aria-haspopup="dialog"
						className={`efg-lift flex ${TILE} cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-2 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${chosenElsewhere ? "border-amber-400 bg-gray-900" : moreOpen ? "border-amber-400/70 bg-gray-900" : "border-white/25 bg-gray-950/90 hover:border-amber-400/60 hover:bg-gray-900"}`}
					>
						{chosenElsewhere ? (
							<>
								<span className="flex max-w-full items-center gap-1.5 text-sm font-bold leading-5 text-white sm:text-[15px]">
									<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chosenElsewhere.color }} />
									<span className="truncate">{chosenElsewhere.label}</span>
								</span>
								<span className="text-[11px] font-semibold leading-4 text-amber-400 sm:text-xs">More moods</span>
							</>
						) : (
							<>
								<Squares2X2Icon className="h-6 w-6 text-amber-400 sm:h-7 sm:w-7" aria-hidden />
								<span className="text-sm font-bold leading-5 text-white sm:text-[15px]">More moods</span>
								<span className="hi-ex text-[11px] leading-4 text-gray-400 sm:text-xs">{rest} more</span>
							</>
						)}
					</button>
				</li>
			</ul>
		</div>
	)
}

/** Answers a choice from More moods: a Discover mood with its own titles, anything else as a search for its name. */
export function pickVocab(f: StageFlow, item: VocabItem) {
	pushRecent(item.id)
	if (item.moodKey && f.data.guest.moods.some((m) => m.key === item.moodKey)) f.mood(item.moodKey)
	else {
		f.prompt(item.label)
		f.setDraft("")
	}
}

/** Whether a vocabulary item is what's on show. */
export const isChosen = (f: StageFlow, item: VocabItem) => vocabOf(f.source)?.id === item.id

/** 1 pick a mood or search, 2 tap three you loved, 3 your picks. */
export function stepOf(f: StageFlow): 1 | 2 | 3 {
	if (f.done && f.picks.length) return 3
	return f.source.kind !== "popular" || f.loved.length ? 2 : 1
}

export const STEPS = [
	{ long: "Pick a mood or search", short: "Mood or search" },
	{ long: "Tap three you loved", short: "Tap three" },
	{ long: "Your picks", short: "Your picks" },
]

/** What the tray shows, as its title. */
export function trayTitle(f: StageFlow): { text: string; dot?: string } {
	if (f.done && f.picks.length) return { text: "Picked for you" }
	if (f.loading) return { text: `Searching “${f.draft}”…` }
	if (f.source.kind === "popular") return { text: "Popular right now" }
	const v = vocabOf(f.source)
	if (v) return { text: `For “${v.label}”`, dot: v.color }
	return { text: `For ${f.label}` }
}

/**
 * When the guest asks for something and the tray sits below the fold, bring it into view. Never on first paint or a
 * restore: only on a change after mount.
 */
export function useBringIntoView(f: StageFlow) {
	const box = useRef<HTMLDivElement>(null)
	const showPicks = f.done && f.picks.length > 0
	const sourceKey = `${f.source.kind}:${"q" in f.source ? f.source.q : "key" in f.source ? f.source.key : ""}:${showPicks}`
	// Only after the guest did something (a restore or a dev double effect is no reason to scroll).
	const prev = useRef<string | null>(null)
	const acted = useRef(false)
	useEffect(() => {
		const on = () => {
			acted.current = true
		}
		window.addEventListener("pointerdown", on, true)
		window.addEventListener("keydown", on, true)
		return () => {
			window.removeEventListener("pointerdown", on, true)
			window.removeEventListener("keydown", on, true)
		}
	}, [])
	useEffect(() => {
		const was = prev.current
		prev.current = sourceKey
		if (was === null || was === sourceKey || !acted.current) return
		const el = box.current
		if (!el) return
		const r = el.getBoundingClientRect()
		const room = window.innerHeight - 72 // the lab bar
		if (r.bottom > room) window.scrollBy({ top: Math.min(r.top - 80, r.bottom - room), behavior: "smooth" })
	}, [sourceKey])
	return box
}

/**
 * A real poster card that is itself the "loved it" toggle, like the TV quiz: a tap rings it, pops a heart and lifts
 * it; a second tap undoes. The small info button opens the title page (shown on hover with a pointer, always on touch).
 */
export function ToggleCard({
	card,
	on,
	full,
	onToggle,
	priority,
	className = "",
}: {
	card: LabCard
	on: boolean
	/** Three are loved: the others can't be tapped. */
	full: boolean
	onToggle: () => void
	priority?: boolean
	className?: string
}) {
	const off = full && !on
	return (
		<div className={`hi-tog relative shrink-0 ${on ? "hi-on" : ""} ${off ? "hi-off" : ""} ${className}`}>
			<div className="hi-lift">
				<TitlePosterCard card={card} actions={false} posterPriority={priority ? "high" : undefined} />
				<button
					type="button"
					className="hi-tap"
					aria-pressed={on}
					disabled={off}
					aria-label={`Loved ${card.title}`}
					onClick={onToggle}
				/>
				<span className="hi-ring" aria-hidden />
				<span className="hi-badge" aria-hidden>
					<HeartIcon className="h-4 w-4" />
				</span>
				<Link
					to={titleHref(card)}
					prefetch="none"
					aria-label={`Open ${card.title}`}
					className="hi-info absolute top-1 left-1 z-[31] flex h-7 w-7 items-center justify-center rounded-full bg-gray-950/80 text-gray-100 ring-1 ring-white/25 outline-none hover:bg-gray-900 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-8 sm:w-8"
				>
					<InformationCircleIcon className="h-5 w-5" aria-hidden />
				</Link>
			</div>
		</div>
	)
}

/** The loading placeholders for a poster row. */
export function SkeletonRow({ col, n = 10 }: { col: string; n?: number }) {
	return (
		<>
			{Array.from({ length: n }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
				<div key={i} className={`${col} shrink-0`}>
					<div className="aspect-[2/3] animate-pulse rounded-lg bg-gray-800/80" style={{ animationDelay: `${i * 80}ms` }} />
				</div>
			))}
		</>
	)
}

export { NEED }
