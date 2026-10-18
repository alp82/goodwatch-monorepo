// PROTOTYPE - throwaway (branch prototype/onboarding-imports), round 3. Owner: "H, but not a card, use the whole
// space and width. the first step should have the nice drop first UX of C. the import logos could be a row of
// slightly overlapping logos with hover/tap triggering popouts with the name and what they import. make the
// stepper more beautiful, E is nicer here." /taste?variant=I.
import { ArrowUpTrayIcon, CheckIcon } from "@heroicons/react/20/solid"
import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { primaryButton, secondaryButton, textLink } from "~/ui/imports/shared"
import type { ScoringMedia } from "~/ui/scoring/types"
import { RatingDots } from "~/ui/taste-quiz/TasteQuizPage"
import { assetUrl } from "~/utils/asset-url"
import {
	GOAL,
	GetYourData,
	ImportStatus,
	PageDrop,
	RateCard,
	WaitChip,
	ghost,
	source,
} from "./OnboardingImports"
import {
	type Flow,
	PosterFan,
	PosterWall,
	ReadyActions,
	SLOW,
	STEP_LABELS,
	WaitingNote,
	stepWords,
	useFlow,
} from "./OnboardingImports2"

// ---------------------------------------------------------------------------------------------------------------
// The stepper: E's dots and line, larger, with the line filling in amber (a transform, so it animates smoothly).

function Stepper({ f }: { f: Flow }) {
	const reached = f.step === 3 || f.ready ? 2 : f.step === 2 || f.done(1) ? 1 : 0
	return (
		<nav aria-label="Getting started" className="mx-auto w-full max-w-3xl">
			<div className="relative">
				{/* The track runs between the first and last dot centers. */}
				<div aria-hidden className="absolute left-[16.66%] right-[16.66%] top-[22px] h-1 overflow-hidden rounded-full bg-white/15">
					<div
						className="h-full origin-left rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-transform duration-700 ease-out"
						style={{ transform: `scaleX(${reached / 2})` }}
					/>
				</div>
				<ol className="relative grid grid-cols-3">
					{([1, 2, 3] as const).map((n) => {
						const done = f.done(n) || (n < f.step && n !== 1)
						const on = f.step === n
						return (
							<li key={n} className="flex flex-col items-center text-center">
								<button
									type="button"
									onClick={() => f.setStep(n)}
									aria-current={on ? "step" : undefined}
									aria-label={`Step ${n}: ${STEP_LABELS[n - 1]}`}
									className={`flex size-12 cursor-pointer items-center justify-center rounded-full text-base font-black transition-transform duration-300 ${on ? "scale-110" : ""} ${done ? "bg-amber-400 text-gray-950 ring-4 ring-gray-950" : on ? "bg-gray-950 text-amber-300 ring-4 ring-amber-400 shadow-[0_0_0_8px_rgba(3,7,18,1)]" : "bg-gray-900 text-gray-400 ring-4 ring-gray-950"}`}
								>
									{done ? <CheckIcon className="size-6" aria-hidden /> : n}
								</button>
								<span className={`mt-3 text-sm font-bold md:text-base ${on ? "text-white" : "text-gray-400"}`}>{STEP_LABELS[n - 1]}</span>
								<span className={`text-xs md:text-sm ${on ? "text-amber-300/90" : "text-gray-500"}`}>{f.note(n) || " "}</span>
							</li>
						)
					})}
				</ol>
			</div>
		</nav>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The logo row: overlapping marks; hover, focus, or tap opens a pop-out with the name, what it imports, the wait,
// and the way in. The pop-out sits under the row with a pointer at its logo, so it never runs off a phone screen.

function Logo({ s, size = "size-14" }: { s: ImportSourceEntry; size?: string }) {
	const frame = `flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-2xl`
	if (!s.logo)
		return (
			<span aria-hidden className={`${frame} bg-zinc-600 text-sm font-black tracking-tight text-white`}>
				{s.tile}
			</span>
		)
	return (
		<span aria-hidden className={`${frame} ${s.id === "tmdb" ? "bg-[#0d253f] p-1.5" : ""}`}>
			<img src={assetUrl(s.logo)} alt="" className="size-full object-contain" />
		</span>
	)
}

function LogoRow({ f, onOpen }: { f: Flow; onOpen: (id: ImportSourceId) => void }) {
	const [hot, setHot] = useState<ImportSourceId | null>(null)
	const [pinned, setPinned] = useState(false)
	const row = useRef<HTMLDivElement>(null)
	const pop = useRef<HTMLDivElement>(null)
	const caretEl = useRef<HTMLSpanElement>(null)
	const logoX = useRef(0)
	const point = (el: HTMLElement) => {
		const b = el.getBoundingClientRect()
		logoX.current = b.left + b.width / 2
	}
	// The pointer sits under the hovered logo, measured against where the pop-out landed.
	useLayoutEffect(() => {
		if (!hot || !pop.current || !caretEl.current) return
		caretEl.current.style.left = `${logoX.current - pop.current.getBoundingClientRect().left - 6}px`
	}, [hot])
	// A tap or click outside closes a pinned pop-out.
	useEffect(() => {
		if (!pinned) return
		const close = (e: PointerEvent) => {
			if (!row.current?.contains(e.target as Node)) {
				setPinned(false)
				setHot(null)
			}
		}
		window.addEventListener("pointerdown", close)
		return () => window.removeEventListener("pointerdown", close)
	}, [pinned])
	const s = hot ? source(hot) : null
	return (
		<div
			ref={row}
			className="relative mx-auto flex w-full max-w-xl flex-col items-center"
			onMouseLeave={() => !pinned && setHot(null)}
		>
			<div className="text-sm text-gray-400">Need the file? Pick where it lives</div>
			<ul className="mt-3 flex items-center justify-center pl-3" aria-label="Import sources">
				{IMPORT_SOURCE_LIST.map((x, i) => (
					<li key={x.id} className="-ml-3" style={{ zIndex: hot === x.id ? 20 : 10 - Math.abs(i - 4) }}>
						<button
							type="button"
							aria-expanded={hot === x.id}
							aria-label={x.name}
							onMouseEnter={(e) => {
								if (pinned) return
								setHot(x.id)
								point(e.currentTarget)
							}}
							onFocus={(e) => {
								setHot(x.id)
								point(e.currentTarget)
							}}
							onClick={(e) => {
								point(e.currentTarget)
								if (hot === x.id && pinned) {
									setPinned(false)
									setHot(null)
								} else {
									setHot(x.id)
									setPinned(true)
								}
							}}
							className={`block cursor-pointer rounded-2xl ring-4 ring-gray-950 transition-transform duration-200 ease-out ${hot === x.id ? "-translate-y-1.5 scale-110" : "hover:-translate-y-1"} ${hot && hot !== x.id ? "opacity-60" : ""}`}
						>
							<Logo s={x} size="size-12 md:size-14" />
						</button>
					</li>
				))}
			</ul>
			<div className="relative h-0 w-full">
				{s && (
					<div ref={pop} role="dialog" aria-label={s.name} className="absolute inset-x-0 top-3 z-30 mx-auto w-full max-w-sm rounded-2xl bg-gray-900 p-4 text-left shadow-2xl ring-1 ring-white/10">
						<span
							ref={caretEl}
							aria-hidden
							className="absolute -top-1.5 size-3 rotate-45 border-l border-t border-white/10 bg-gray-900"
						/>
						<div className="flex items-center gap-3">
							<SourceMark source={s} />
							<div className="min-w-0 flex-1">
								<div className="font-bold text-white">{s.name}</div>
								<div className="text-xs text-gray-400">{s.connect ? "Connect your account" : "Upload an export file"}</div>
							</div>
							<WaitChip s={s} />
						</div>
						<ul className="mt-3 flex flex-wrap gap-1.5">
							{s.gets.map((g) => (
								<li key={g} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-gray-200">
									{g}
								</li>
							))}
						</ul>
						<button
							type="button"
							className={`${s.connect ? primaryButton : secondaryButton} mt-4 w-full`}
							onClick={() => {
								setPinned(false)
								setHot(null)
								onOpen(s.id)
							}}
						>
							{s.connect ? `Connect ${s.name}` : `How to get your ${s.name} file`}
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C's drop zone, as wide as the page allows.

function WideDrop({ f, children }: { f: Flow; children?: React.ReactNode }) {
	const input = useRef<HTMLInputElement>(null)
	const [over, setOver] = useState(false)
	const s = f.pick ? source(f.pick) : null
	return (
		<div
			onDragOver={(e) => {
				e.preventDefault()
				setOver(true)
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault()
				e.stopPropagation()
				setOver(false)
				f.take(e.dataTransfer.files[0])
			}}
			className={`flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors md:py-14 ${over ? "border-amber-300 bg-amber-400/10" : "border-white/20 bg-gray-950/50 hover:border-white/35"}`}
		>
			<ArrowUpTrayIcon className={`size-12 transition-transform duration-300 md:size-14 ${over ? "-translate-y-1 text-amber-300" : "text-gray-400"}`} aria-hidden />
			<p className="text-xl font-bold text-white md:text-2xl">{s ? `Drop your ${s.name} file here` : "Drop your export here"}</p>
			<p className="max-w-md text-sm text-gray-400">GoodWatch works out where it's from and reads it on your device first. Nothing changes until you check it.</p>
			<div className="mt-1 flex flex-wrap justify-center gap-2">
				<button type="button" className={primaryButton} onClick={() => input.current?.click()}>
					Choose file
				</button>
				<button type="button" className={secondaryButton} onClick={() => f.imp.sample(s && !s.connect ? s.id : "letterboxd")}>
					Try a sample file
				</button>
			</div>
			{children && <div className="mt-6 w-full border-t border-white/10 pt-6">{children}</div>}
			<input
				ref={input}
				type="file"
				className="sr-only"
				tabIndex={-1}
				aria-label="Choose an export file"
				onChange={(e) => {
					f.take(e.target.files?.[0])
					e.target.value = ""
				}}
			/>
		</div>
	)
}

/** The picked source's way in, under the drop zone. */
function SourceSteps({ f }: { f: Flow }) {
	if (!f.pick) return null
	const s = source(f.pick)
	return (
		<div className="w-full rounded-2xl bg-gray-900/80 p-5 text-left text-gray-300 ring-1 ring-white/10 md:p-6">
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<SourceMark source={s} />
				<span className="text-lg font-bold text-white">{s.name}</span>
				<WaitChip s={s} />
				<button type="button" className={`${textLink} ml-auto text-sm`} onClick={() => f.setPick(null)}>
					Pick another source
				</button>
			</div>
			<GetYourData id={s.id} imp={f.imp} />
			{SLOW.includes(s.id) && (
				<div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
					<span className="text-sm text-gray-400">{s.name} needs {s.wait.toLowerCase()} to make the file.</span>
					<button type="button" className={ghost} onClick={f.rateWhileWaiting}>
						Rate a few while you wait
					</button>
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantI({ shelf }: { shelf: ScoringMedia[] }) {
	const f = useFlow(shelf)
	const w = stepWords(f)
	const p = f.imp.phase
	const connectPicked = f.pick && source(f.pick).connect
	return (
		<div className="text-white">
			<PageDrop onFile={f.take} />
			<PosterWall shelf={shelf} count={72} cols="grid-cols-6 md:grid-cols-12" opacity="opacity-25" className="min-h-[calc(100vh-4rem)]">
				<div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 pb-24 pt-8 md:px-8 md:pt-12">
					<Stepper f={f} />
					<header className="max-w-3xl text-center">
						<h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">{w.title}</h1>
						<p className="mx-auto mt-4 max-w-2xl text-gray-300 md:text-lg">{w.text}</p>
					</header>

					{f.step === 1 && (
						<div className="flex w-full max-w-5xl flex-col items-center gap-8">
							{p.kind === "idle" ? (
								<>
									{!connectPicked && (
										<WideDrop f={f}>{!f.pick && <LogoRow f={f} onOpen={(id) => f.setPick(id)} />}</WideDrop>
									)}
									<SourceSteps f={f} />
									{!f.pick && (
										<>
											<div className="mt-6 flex flex-col items-center gap-2">
												<span className="text-gray-400">Never tracked anything? That's fine.</span>
												<button type="button" className={ghost} onClick={() => f.setStep(2)}>
													Nowhere yet. I'll rate a few here
												</button>
											</div>
										</>
									)}
								</>
							) : (
								<div className="flex w-full max-w-3xl flex-col gap-4">
									<ImportStatus imp={f.imp} shelf={shelf} />
									{p.kind === "done" && !f.ready && (
										<button type="button" className={`${primaryButton} self-center`} onClick={() => f.setStep(2)}>
											Rate a few to fill it in
										</button>
									)}
								</div>
							)}
						</div>
					)}

					{f.step === 2 && (
						<div className="flex w-full max-w-5xl flex-col gap-5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-3 text-sm text-gray-300">
									<RatingDots at={f.liked} of={GOAL} />
									{Math.min(f.liked, GOAL)} of {GOAL} liked
								</div>
								<button type="button" className={`${textLink} text-sm`} onClick={() => f.setStep(1)}>
									I do track somewhere
								</button>
							</div>
							<WaitingNote f={f} />
							<RateCard r={f.r} />
						</div>
					)}

					{f.step === 3 && (
						<div className="flex w-full flex-col items-center gap-6">
							<div className="scale-110 md:scale-125">
								<PosterFan f={f} shelf={shelf} />
							</div>
							<ReadyActions f={f} />
						</div>
					)}
				</div>
			</PosterWall>
		</div>
	)
}
