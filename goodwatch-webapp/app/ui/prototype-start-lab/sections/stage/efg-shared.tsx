// PROTOTYPE (start page lab, round 3): what stage e, f and g share: the stage shell (the scene pushed down so its calm
// top sits behind the search block, stage a's tray over the rug), the lifted search field, the example prompts and a
// bigger poster fan.
import type { CSSProperties, ReactNode } from "react"
import { tmdbImage } from "../../lab/kit"
import { type LabCard, useLab } from "../../lab/types"
import { SearchField } from "../hero/shared"
import { type StageFlow, useStageFlow } from "./ab-shared"
import { EfgTray } from "./efg-tray"

/** The night behind the room: the scene fades into it at the top. */
export const NIGHT = "#050a16"

const CSS = `@keyframes ab-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ab-in{animation:ab-in .35s cubic-bezier(.2,.8,.2,1) both}
.efg-glow{opacity:0;transition:opacity .25s ease-out}
.efg-field:focus-within .efg-glow{opacity:1}
.efg-fan-card{transform:translateX(calc(-50% + var(--x))) rotate(var(--r));transition:transform .35s cubic-bezier(.2,.8,.2,1)}
@media (hover:hover){.efg-fan-host:hover .efg-fan-card{transform:translateX(calc(-50% + var(--x2))) translateY(var(--y2)) rotate(var(--r2))}}
.efg-fan-host:focus-visible .efg-fan-card,.efg-fan-host[aria-pressed=true] .efg-fan-card{transform:translateX(calc(-50% + var(--x2))) translateY(var(--y2)) rotate(var(--r2))}
.efg-lift{transition:transform .25s cubic-bezier(.2,.8,.2,1)}
@media (hover:hover){.efg-lift:hover{transform:translateY(-3px)}}`

/**
 * The stage: the scene starts `--room-top` below the section's top (the space above is night, blended in), so the
 * scene's calm top lands behind the search block; the tray sits at the bottom with room for the lab bar.
 * `vars` sets `--room-top` per breakpoint; `overlays` are drawn over the scene in section coordinates.
 */
export function EfgStage({
	k,
	vars,
	overlays,
	top,
}: {
	k: string
	vars: string
	overlays?: ReactNode
	top: (f: StageFlow) => ReactNode
}) {
	const { Room } = useLab()
	const f = useStageFlow(k)
	return (
		<section aria-label="Find something to watch" className={`relative isolate overflow-hidden ${vars}`} style={{ background: NIGHT }}>
			<style>{CSS}</style>
			<Room noTv focal={[0.5, 0.9]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: "var(--room-top)" }} />
			{/* The scene's top edge melts into the night above it; the bottom darkens under the tray. Static. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					background: `linear-gradient(to bottom, ${NIGHT} 0, ${NIGHT} var(--room-top), rgb(5 10 22 / 0) calc(var(--room-top) + 18vh)), linear-gradient(to bottom, rgb(3 7 18 / 0) 60%, rgb(3 7 18 / .4) 80%, rgb(3 7 18 / .9) 100%)`,
				}}
			/>
			{overlays}
			<div className="pointer-events-none relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[1360px] flex-col px-4 pb-16 sm:px-6 sm:pb-[72px]">
				{top(f)}
				<div className="min-h-5 flex-1" />
				<EfgTray f={f} />
			</div>
		</section>
	)
}

/**
 * The search field as a lifted object: `body` styles the rounded field itself (height, fill, shadow), `decor` sits
 * behind it (shadows, light), `glow` is the focus glow that fades in (opacity only).
 */
export function EfgField({
	f,
	body,
	decor,
	glow,
	className = "",
	inputText = "",
}: {
	f: StageFlow
	body: string
	decor?: ReactNode
	glow: string
	className?: string
	/** Overrides the field's type size, e.g. "[&_input]:!text-[44px]". */
	inputText?: string
}) {
	return (
		<div className={`efg-field pointer-events-auto relative mx-auto w-full ${className}`}>
			{decor}
			<span aria-hidden className={`efg-glow pointer-events-none absolute inset-0 ${glow}`} />
			<div className={`relative flex items-center px-4 sm:px-7 [&>div]:h-full [&>div]:w-full [&_form]:!h-full [&_form+div]:hidden ${inputText} ${body}`}>
				<SearchField
					value={f.draft}
					onChange={f.setDraft}
					onSubmit={f.typed}
					onClear={f.source.kind === "popular" ? undefined : f.clear}
					placeholder="A cozy mystery, a funny show…"
				/>
			</div>
		</div>
	)
}

/** Example prompts: one line that scrolls on phones. */
export function EfgPrompts({ f, className = "" }: { f: StageFlow; className?: string }) {
	const prompts = f.data.guest.prompts.slice(0, 3)
	const on = f.source.kind === "prompt" ? f.source.q : null
	return (
		<div className={`pointer-events-auto -mx-4 overflow-x-auto px-4 [scrollbar-width:none] ${className}`}>
			<div className="mx-auto flex w-max items-center gap-1 text-sm sm:text-[15px]">
				<span className="shrink-0 pr-1 text-gray-300 [text-shadow:0_1px_8px_rgb(0_0_0/.9)]">Try</span>
				{prompts.map((p) => (
					<button
						key={p.q}
						type="button"
						onClick={() => f.prompt(p.q)}
						aria-pressed={on === p.q}
						className={`h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 italic transition-colors sm:h-9 ${on === p.q ? "bg-amber-400 text-gray-950" : "text-gray-100 [text-shadow:0_1px_8px_rgb(0_0_0/.9)] hover:bg-white/10 hover:text-white"}`}
					>
						“{p.q}”
					</button>
				))}
			</div>
		</div>
	)
}

/** Three of a mood's posters, fanned; they spread on hover (and when chosen). `spread` scales the hover spread. */
export function EfgFan({ cards, size, spread = 1, className = "" }: { cards: LabCard[]; size: number; spread?: number; className?: string }) {
	const three = cards.slice(0, 3)
	const h = size * 1.5
	return (
		<span aria-hidden className={`relative block shrink-0 ${className}`} style={{ width: size * 2.2, height: h + 8 }}>
			{three.map((t, i) => {
				const d = i - 1
				return (
					<img
						key={t.key}
						src={tmdbImage(t.poster_path, "w185")}
						alt=""
						loading="lazy"
						draggable={false}
						className="efg-fan-card absolute bottom-0 left-1/2 rounded-[5px] object-cover shadow-[0_6px_14px_rgb(0_0_0/0.55)] ring-1 ring-black/40"
						style={
							{
								width: size,
								height: h,
								zIndex: d === 0 ? 3 : 1,
								transformOrigin: "50% 100%",
								"--x": `${d * size * 0.42}px`,
								"--r": `${d * 9}deg`,
								"--x2": `${d * size * 0.62 * spread}px`,
								"--r2": `${d * 15 * spread}deg`,
								"--y2": d === 0 ? `${-4 * spread}px` : "0px",
							} as CSSProperties
						}
					/>
				)
			})}
		</span>
	)
}
