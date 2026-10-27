// PROTOTYPE (start page lab, round 2): stage b · "One panel, three steps": a fixed-size panel over the scene. 1 search
// or pick a mood, 2 tap three you loved in the results, 3 picks. The steps slide sideways inside the panel, the step
// bar goes back, and the scene's shelves mirror the current step.
import { CheckIcon } from "@heroicons/react/20/solid"
import { useEffect } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import { type BlockVariant, useLab } from "../../lab/types"
import { discoverHref, ReadingLine, SearchField, SeeAll } from "../hero/shared"
import { joinNames, KeepNudge } from "../recs/shared"
import { FAN_CSS, inertProps, LovedButton, LovedCount, moodHue, NEED, PosterFan, type StageFlow, useMoodFaces, useStageFlow } from "./ab-shared"

const CSS = `${FAN_CSS}
@keyframes ab-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ab-in{animation:ab-in .35s cubic-bezier(.2,.8,.2,1) both}`

const STEPS = ["Search", "Tap three", "Your picks"] as const
const GRID = "grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3 lg:grid-cols-7"

function PanelStage() {
	const { Room } = useLab()
	const f = useStageFlow("b", { shelfByStep: true })
	const { step, setStep } = f
	const enough = f.loved.length >= NEED

	// The third heart: on to the picks.
	useEffect(() => {
		if (f.done && f.picks.length) setStep(2)
	}, [f.done, f.picks.length, setStep])

	const go = (to: number) => {
		if (to === 2 && !enough) return
		if (to < 2 && f.done) f.backToResults()
		setStep(to)
	}

	return (
		<section
			aria-label="Find something to watch"
			className="relative isolate h-[calc(100svh-4rem)] min-h-[620px] max-h-[1100px] overflow-hidden sm:min-h-[720px]"
		>
			<style>{CSS}</style>
			<Room noTv focal={[0.5, 0.5]} style={{ position: "absolute", inset: 0 }}>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"radial-gradient(ellipse 60% 55% at 50% 50%, rgb(3 7 18 / .55), rgb(3 7 18 / .1) 70%), linear-gradient(to bottom, rgb(3 7 18 / 0) 80%, rgb(3 7 18) 100%)",
					}}
				/>
			</Room>
			<div className="pointer-events-none relative z-10 flex h-full items-start justify-center px-3 py-3 sm:items-center sm:px-6">
				{/* The panel's size comes from the screen alone, never from what it shows. */}
				<div className="pointer-events-auto relative flex h-full max-h-[720px] w-full max-w-[1080px] flex-col overflow-hidden rounded-3xl bg-gray-950/90 shadow-[0_20px_60px_rgb(0_0_0/0.55)] ring-1 ring-white/10 sm:h-[640px]">
					<StepBar step={step} enough={enough} onGo={go} />
					<div className="relative min-h-0 flex-1 overflow-hidden">
						<div
							className="flex h-full w-[300%] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] will-change-transform"
							style={{ transform: `translateX(${(-100 / 3) * step}%)` }}
						>
							<Pane active={step === 0}>
								<StepSearch f={f} onAnswer={() => setStep(1)} />
							</Pane>
							<Pane active={step === 1}>
								<StepTap f={f} />
							</Pane>
							<Pane active={step === 2}>
								<StepPicks f={f} onAgain={() => {
									f.startOver()
									setStep(1)
								}} />
							</Pane>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

function Pane({ active, children }: { active: boolean; children: React.ReactNode }) {
	return (
		<div
			className="h-full w-1/3 shrink-0 overflow-y-auto overscroll-contain px-4 pb-5 transition-opacity duration-300 [scrollbar-width:thin] sm:px-7"
			style={{ opacity: active ? 1 : 0.25 }}
			{...inertProps(!active)}
		>
			{children}
		</div>
	)
}

function StepBar({ step, enough, onGo }: { step: number; enough: boolean; onGo: (to: number) => void }) {
	return (
		<nav aria-label="Steps" className="relative shrink-0 border-b border-white/10">
			<ol className="flex h-12 items-stretch px-2 sm:h-14 sm:px-4">
				{STEPS.map((label, i) => {
					const open = i < 2 || enough
					const on = step === i
					const past = i < step
					return (
						<li key={label} className="flex-1">
							<button
								type="button"
								onClick={() => onGo(i)}
								disabled={!open}
								aria-current={on ? "step" : undefined}
								className={`flex h-full w-full cursor-pointer items-center justify-center gap-2 rounded-lg text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default sm:text-sm ${on ? "text-white" : open ? "text-gray-400 hover:text-white" : "text-gray-600"}`}
							>
								<span
									className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold transition-colors ${on ? "bg-amber-400 text-gray-950" : past ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-gray-400"}`}
								>
									{past ? <CheckIcon className="h-3.5 w-3.5" aria-hidden /> : i + 1}
								</span>
								<span className="truncate">{label}</span>
							</button>
						</li>
					)
				})}
			</ol>
			<div className="absolute inset-x-0 bottom-[-1px] h-0.5 overflow-hidden">
				<div
					className="h-full w-full origin-left bg-amber-400 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
					style={{ transform: `scaleX(${(step + 1) / 3})` }}
				/>
			</div>
		</nav>
	)
}

function StepSearch({ f, onAnswer }: { f: StageFlow; onAnswer: () => void }) {
	const moods = f.data.guest.moods
	const faces = useMoodFaces(moods)
	const prompts = f.data.guest.prompts.slice(0, 3)
	const moodOn = f.source.kind === "mood" ? f.source.key : null
	return (
		<div className="mx-auto max-w-[920px] pt-4 sm:pt-8">
			<h1 className="text-[22px] font-extrabold leading-7 tracking-tight text-white sm:text-4xl sm:leading-tight">
				Find something to watch by mood or anything
			</h1>
			<p className="mt-1 text-sm text-gray-400 sm:text-base">What are you in the mood for?</p>
			<div className="mt-3 sm:mt-5">
				<SearchField
					value={f.draft}
					onChange={f.setDraft}
					onSubmit={(v) => {
						if (!v.trim()) return
						f.typed(v)
						onAnswer()
					}}
					onClear={f.source.kind === "popular" ? undefined : f.clear}
					placeholder="A cozy mystery, a funny show…"
				/>
			</div>
			<div className="-mx-4 mt-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
				<div className="flex w-max items-center gap-1 text-sm">
					<span className="shrink-0 pr-1 text-gray-400">Try</span>
					{prompts.map((p) => (
						<button
							key={p.q}
							type="button"
							onClick={() => {
								f.prompt(p.q)
								onAnswer()
							}}
							className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 italic text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
						>
							“{p.q}”
						</button>
					))}
				</div>
			</div>
			{/* The moods as a list: each one's color down its edge, its posters fanned, the name and two titles. */}
			<ul className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4">
				{moods.map((m) => {
					const hue = moodHue(m.key)
					const on = moodOn === m.key
					return (
						<li key={m.key}>
							<button
								type="button"
								onClick={() => {
									f.mood(m.key)
									onAnswer()
								}}
								aria-pressed={on}
								className={`ab-fan-host flex h-[58px] w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl pr-2 pl-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-[72px] sm:gap-3 sm:pl-2 ${on ? "bg-white/10 ring-2 ring-amber-400" : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08]"}`}
								style={{
									boxShadow: `inset 3px 0 0 ${hue}`,
									backgroundImage: `linear-gradient(to right, ${hue}2e, transparent 55%)`,
								}}
							>
								<PosterFan cards={faces[m.key]?.fan ?? []} size={22} className="sm:hidden" />
								<PosterFan cards={faces[m.key]?.fan ?? []} size={30} className="hidden sm:block" />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-semibold text-white sm:text-[15px]">{m.label}</span>
									<span className="block truncate text-[11px] leading-4 text-gray-400 sm:text-xs">{faces[m.key]?.examples}</span>
								</span>
							</button>
						</li>
					)
				})}
				<li>
					<button
						type="button"
						onClick={() => {
							f.clear()
							onAnswer()
						}}
						className="flex h-[58px] w-full cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm font-semibold text-amber-400 border border-dashed border-white/20 transition-colors hover:bg-amber-400/10 sm:h-[72px]"
					>
						Or tap from popular <span aria-hidden>&nbsp;→</span>
					</button>
				</li>
			</ul>
		</div>
	)
}

function StepTap({ f }: { f: StageFlow }) {
	const full = f.loved.length >= NEED
	const key = f.source.kind === "popular" ? "popular" : `${f.source.kind}:${"q" in f.source ? f.source.q : f.source.key}`
	return (
		<div className="pt-3 sm:pt-5">
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="text-lg font-extrabold leading-6 tracking-tight text-white sm:text-2xl sm:leading-8">
						Seen any of these? <span className="text-amber-400">Tap three you loved</span>
					</h2>
					<div className="mt-1 flex h-6 min-w-0 items-center text-xs text-gray-400 sm:text-sm">
						{f.loading ? (
							f.reading ? (
								<ReadingLine answer={{ q: f.draft, answeredAs: f.draft, kind: "prompt", reading: f.reading, titles: [] }} className="min-w-0 flex-1 !text-xs sm:!text-sm" />
							) : (
								<span className="inline-flex items-center gap-2">
									<span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden />
									Reading “{f.source.kind === "typed" ? f.source.q : f.draft}”…
								</span>
							)
						) : f.answer && f.source.kind !== "mood" ? (
							<ReadingLine answer={f.answer} className="min-w-0 flex-1 !text-xs sm:!text-sm" />
						) : (
							<span className="truncate">{f.source.kind === "popular" ? "Popular right now" : `Mood: ${f.label}`}</span>
						)}
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1 pt-0.5 text-sm text-gray-300">
					<LovedCount loved={f.loved} />
					{f.seeAllQ && !f.loading ? <SeeAll q={f.seeAllQ} className="-mr-3 h-7" /> : null}
				</div>
			</div>
			<div className="mt-3 sm:mt-4">
				{f.loading ? (
					<div className={GRID}>
						{Array.from({ length: 14 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
							<div key={i}>
								<div className="aspect-[2/3] animate-pulse rounded-lg bg-gray-800/80" style={{ animationDelay: `${i * 60}ms` }} />
								<div className="mt-1.5 h-7 rounded-md bg-gray-800/50" />
							</div>
						))}
					</div>
				) : (
					<div key={key} className={`${GRID} ab-in`}>
						{f.results.slice(0, 18).map((card, i) => (
							<div key={card.key}>
								<TitlePosterCard card={card} actions={false} posterPriority={i < 6 ? "high" : undefined} />
								<LovedButton on={f.isLoved(card)} disabled={full} onClick={() => f.toggleLoved(card)} compact />
							</div>
						))}
					</div>
				)}
				{f.seeAllQ && !f.loading ? (
					<a href={discoverHref(f.seeAllQ)} className="mt-4 block text-center text-sm font-semibold text-amber-400 hover:text-amber-300">
						See all on Discover <span aria-hidden>→</span>
					</a>
				) : null}
			</div>
		</div>
	)
}

function StepPicks({ f, onAgain }: { f: StageFlow; onAgain: () => void }) {
	return (
		<div className="flex min-h-full flex-col pt-3 sm:pt-5">
			<div className="flex items-center gap-3">
				<div className="flex shrink-0 -space-x-2" aria-hidden>
					{f.loved.map((c) => (
						<img key={c.key} src={tmdbImage(c.poster_path, "w185")} alt="" className="aspect-[2/3] w-7 rounded border border-gray-950 object-cover sm:w-9" />
					))}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="text-lg font-extrabold leading-6 tracking-tight text-white sm:text-2xl sm:leading-8">Picked for you</h2>
					<p className="truncate text-xs text-gray-300 sm:text-sm">
						Because you loved <b className="text-white">{joinNames(f.loved)}</b>
					</p>
				</div>
			</div>
			<div className={`mt-3 sm:mt-4 ${GRID}`}>
				{f.picks.slice(0, 14).map((card) => (
					<div key={card.key}>
						<TitlePosterCard card={card} actions={false} />
					</div>
				))}
			</div>
			{/* Sticks to the panel's bottom while the picks scroll. */}
			<div className="sticky bottom-0 -mx-4 mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/10 bg-gray-950 px-4 pt-3 pb-1 sm:-mx-7 sm:px-7">
				<KeepNudge>Keep these and get new picks every day.</KeepNudge>
				<button type="button" onClick={onAgain} className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-white">
					Tap three others
				</button>
			</div>
		</div>
	)
}

export const variant: BlockVariant = { key: "b", name: "One panel, three steps", C: PanelStage }
