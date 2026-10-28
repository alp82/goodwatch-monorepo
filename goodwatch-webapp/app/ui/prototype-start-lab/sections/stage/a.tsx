// PROTOTYPE (start page lab, round 2): stage a · "Tray on the rug": the scene fills the first screen; the H1, a big
// field and poster-fan moods sit in its calm top, and a fixed-height tray docks over the rug: popular titles, then a
// search's results, each with "Loved it"; after three it turns into picks, same height.
import { useLab } from "../../lab/types"
import { ReadingLine, SearchField, SeeAll } from "../hero/shared"
import { joinNames, KeepNudge } from "../recs/shared"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import type { BlockVariant } from "../../lab/types"
import { FAN_CSS, inertProps, LovedButton, LovedCount, moodHue, useMoodFaces, NEED, PosterFan, type StageFlow, useStageFlow } from "./ab-shared"

const CSS = `${FAN_CSS}
@keyframes ab-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ab-in{animation:ab-in .35s cubic-bezier(.2,.8,.2,1) both}`

// One card column: the poster card and its toggle. Phones 96 px, wider screens 132 px.
const COL = "w-[96px] shrink-0 sm:w-[132px]"

function TrayStage() {
	const { Room } = useLab()
	const f = useStageFlow("a")
	return (
		<section
			aria-label="Find something to watch"
			className="relative isolate h-[calc(100svh-4rem)] min-h-[600px] max-h-[1100px] overflow-hidden sm:min-h-[680px]"
		>
			<style>{CSS}</style>
			<Room noTv focal={[0.5, 0.5]} style={{ position: "absolute", inset: 0 }}>
				{/* Legibility for the top and the tray; static, nothing blurred. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"linear-gradient(to bottom, rgb(3 7 18 / .9) 0%, rgb(3 7 18 / .62) 30%, rgb(3 7 18 / .15) 50%, rgb(3 7 18 / 0) 60%, rgb(3 7 18 / .35) 80%, rgb(3 7 18 / .85) 100%)",
					}}
				/>
			</Room>
			<div className="pointer-events-none relative z-10 mx-auto flex h-full w-full max-w-[1360px] flex-col px-4 sm:px-6">
				<Top f={f} />
				<div className="min-h-2 flex-1" />
				<Tray f={f} />
			</div>
		</section>
	)
}

function Top({ f }: { f: StageFlow }) {
	const moods = f.data.guest.moods
	const prompts = f.data.guest.prompts.slice(0, 3)
	const faces = useMoodFaces(moods)
	const moodOn = f.source.kind === "mood" ? f.source.key : null
	const promptOn = f.source.kind === "prompt" ? f.source.q : null
	return (
		<div className="pointer-events-auto pt-4 sm:pt-10">
			<h1 className="text-center text-[22px] font-extrabold leading-7 tracking-tight text-white sm:text-4xl sm:leading-tight">
				Find something to watch by mood or anything
			</h1>
			<div className="mx-auto mt-3 max-w-3xl rounded-2xl bg-gray-950/80 px-4 ring-1 ring-white/10 sm:mt-6 sm:px-6">
				<SearchField
					value={f.draft}
					onChange={f.setDraft}
					onSubmit={f.typed}
					onClear={f.source.kind === "popular" ? undefined : f.clear}
					placeholder="A cozy mystery, a funny show…"
				/>
			</div>
			{/* Example prompts: one line that scrolls on phones. */}
			<div className="-mx-4 mt-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mt-3">
				<div className="mx-auto flex w-max items-center gap-1 text-sm">
					<span className="shrink-0 pr-1 text-gray-400">Try</span>
					{prompts.map((p) => (
						<button
							key={p.q}
							type="button"
							onClick={() => f.prompt(p.q)}
							aria-pressed={promptOn === p.q}
							className={`h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 italic transition-colors ${promptOn === p.q ? "bg-amber-400 text-gray-950" : "text-gray-200 hover:bg-white/10 hover:text-white"}`}
						>
							“{p.q}”
						</button>
					))}
				</div>
			</div>
			{/* The moods: a fan of each mood's own posters on its color, the name and two of its titles. */}
			<div className="-mx-4 mt-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:mt-4 sm:px-6">
				<ul className="flex w-max gap-2 lg:mx-auto">
					{moods.map((m) => {
						const on = moodOn === m.key
						const hue = moodHue(m.key)
						return (
							<li key={m.key}>
								<button
									type="button"
									onClick={() => (on ? f.clear() : f.mood(m.key))}
									aria-pressed={on}
									className={`ab-fan-host flex w-[96px] cursor-pointer flex-col items-center rounded-xl px-1.5 pt-1.5 pb-1.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:w-[112px] sm:pt-2 ${on ? "bg-gray-900 ring-2 ring-amber-400" : "bg-gray-950/75 ring-1 ring-white/10 hover:bg-gray-900"}`}
									style={{ backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 42%, ${hue}${on ? "66" : "38"}, transparent 75%)` }}
								>
									<PosterFan cards={faces[m.key]?.fan ?? []} size={26} className="sm:hidden" />
									<PosterFan cards={faces[m.key]?.fan ?? []} size={34} className="hidden sm:block" />
									<span className="mt-1 flex max-w-full items-center gap-1.5 text-[13px] font-semibold leading-4 text-white sm:text-sm">
										<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hue }} />
										<span className="truncate">{m.label}</span>
									</span>
									<span className="mt-0.5 block w-full truncate text-[11px] leading-4 text-gray-400">{faces[m.key]?.examples}</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

/** Fixed height; results and picks swap inside it. */
function Tray({ f }: { f: StageFlow }) {
	const showPicks = f.done && f.picks.length > 0
	return (
		<div className="pointer-events-auto relative mb-2 h-[256px] overflow-hidden rounded-2xl bg-gray-950/88 shadow-[0_-10px_40px_rgb(0_0_0/0.45)] ring-1 ring-white/10 sm:mb-4 sm:h-[328px]">
			<div
				className="absolute inset-0 px-3 pt-2.5 transition-[opacity,transform] duration-300 ease-out sm:px-4 sm:pt-3.5"
				style={{ opacity: showPicks ? 0 : 1, transform: showPicks ? "translateY(-12px)" : "none" }}
				{...inertProps(showPicks)}
			>
				<Results f={f} />
			</div>
			<div
				className="absolute inset-0 px-3 pt-2.5 transition-[opacity,transform] duration-300 ease-out sm:px-4 sm:pt-3.5"
				style={{ opacity: showPicks ? 1 : 0, transform: showPicks ? "none" : "translateY(12px)" }}
				{...inertProps(!showPicks)}
			>
				{showPicks ? <Picks f={f} /> : null}
			</div>
		</div>
	)
}

function Results({ f }: { f: StageFlow }) {
	const full = f.loved.length >= NEED
	const sourceKey = f.source.kind === "popular" ? "popular" : `${f.source.kind}:${f.source.kind === "mix" ? f.source.ids.join() : "q" in f.source ? f.source.q : f.source.key}`
	return (
		<>
			<div className="flex h-[44px] flex-col justify-center sm:h-[48px]">
				<div className="flex items-center gap-3">
					<h2 className="text-base font-extrabold tracking-tight text-white sm:text-lg">Tap three you loved</h2>
					<span className="text-sm text-gray-300">
						<LovedCount loved={f.loved} />
					</span>
				</div>
				<div className="flex h-5 min-w-0 items-center gap-2 text-xs text-gray-400 sm:text-sm">
					{f.loading ? (
						f.reading ? (
							<ReadingLine answer={{ q: f.draft, answeredAs: f.draft, kind: "prompt", reading: f.reading, titles: [] }} className="min-w-0 flex-1 !text-xs sm:!text-sm" />
						) : (
							<span className="inline-flex items-center gap-2">
								<span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden />
								Reading your search…
							</span>
						)
					) : f.answer && f.source.kind !== "popular" && f.source.kind !== "mood" ? (
						<ReadingLine answer={f.answer} className="min-w-0 flex-1 !text-xs sm:!text-sm" />
					) : (
						<span className="truncate">
							{f.source.kind === "popular" ? "Popular right now" : `Mood: ${f.label}`}
							{f.loved.length ? ` · ${joinNames(f.loved)}` : ""}
						</span>
					)}
					{f.seeAllQ && !f.loading ? <SeeAll q={f.seeAllQ} className="ml-auto -mr-2 h-7 !text-xs sm:!text-sm" /> : null}
				</div>
			</div>
			<div className="relative mt-2">
				{f.loading ? (
					<Row key="loading">
						{Array.from({ length: 10 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
							<div key={i} className={COL}>
								<div className="aspect-[2/3] animate-pulse rounded-lg bg-gray-800/80" style={{ animationDelay: `${i * 80}ms` }} />
								<div className="mt-1.5 h-7 rounded-md bg-gray-800/50 sm:h-8" />
							</div>
						))}
					</Row>
				) : (
					<Row key={sourceKey} className="ab-in">
						{f.results.slice(0, 18).map((card, i) => {
							const on = f.isLoved(card)
							return (
								<div key={card.key} className={COL}>
									<TitlePosterCard card={card} actions={false} posterPriority={i < 4 ? "high" : undefined} />
									<LovedButton on={on} disabled={full} onClick={() => f.toggleLoved(card)} compact />
								</div>
							)
						})}
					</Row>
				)}
			</div>
		</>
	)
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
	return <div className={`-mx-3 flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] sm:-mx-4 sm:gap-3 sm:px-4 ${className}`}>{children}</div>
}

function Picks({ f }: { f: StageFlow }) {
	return (
		<>
			<div className="flex h-[44px] items-center gap-3 sm:h-[48px]">
				<div className="flex shrink-0 -space-x-2" aria-hidden>
					{f.loved.map((c) => (
						<img key={c.key} src={tmdbImage(c.poster_path, "w185")} alt="" className="aspect-[2/3] w-6 rounded border border-gray-950 object-cover sm:w-7" />
					))}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-extrabold tracking-tight text-white sm:text-lg">Picked for you</h2>
					<p className="truncate text-xs text-gray-300 sm:text-sm">
						Because you loved <b className="text-white">{joinNames(f.loved)}</b>
					</p>
				</div>
				<button type="button" onClick={f.backToResults} className="h-8 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300">
					<span aria-hidden>← </span>Results
				</button>
			</div>
			<div className="mt-2">
				<Row className="ab-in !pb-2">
					{f.picks.map((card) => (
						<div key={card.key} className={COL}>
							<TitlePosterCard card={card} actions={false} />
						</div>
					))}
				</Row>
				<div className="flex h-[34px] items-center justify-between gap-3 sm:h-[38px]">
					<div className="min-w-0 truncate text-xs sm:text-sm [&_p]:truncate [&_p]:!text-xs sm:[&_p]:!text-sm">
						<KeepNudge>Keep these and get new picks every day.</KeepNudge>
					</div>
					<button type="button" onClick={f.startOver} className="shrink-0 cursor-pointer text-xs font-semibold text-gray-400 hover:text-white sm:text-sm">
						Start over
					</button>
				</div>
			</div>
		</>
	)
}

export const variant: BlockVariant = { key: "a", name: "Tray on the rug", C: TrayStage }
