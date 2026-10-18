// The Taste page for a member with no taste yet, in three steps under a stepper: bring your history (drop an export
// or pick where it lives), rate a few titles, and see the taste. Both paths count toward the same liked titles; once
// there are enough, "See your taste" asks the page again and the taste takes this one's place.
import { useRevalidator } from "@remix-run/react"
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import type { ImportHandoff } from "~/ui/imports/ImportFileRouting"
import {
	type ImportSourceId,
	importSourceName,
	lastImported,
} from "~/ui/imports/ImportSources"
import { useSourceImports } from "~/ui/imports/SourceImportHooks"
import { useImdbImports } from "~/ui/imports/api"
import { primaryButton } from "~/ui/imports/shared"
import type { ScoringMedia } from "~/ui/scoring/types"
import { RatingDots } from "~/ui/taste-quiz/TasteQuizPage"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import useLocale from "~/utils/locale"
import { useTasteScoring } from "../hooks/useTasteScoring"
import { SourceLogoRow } from "./SourceLogoRow"
import {
	PageDrop,
	SourceSteps,
	StartDropZone,
	type StartHandoff,
	StartImportFlow,
	ghostButton,
	sourceEntry,
	useFileTaking,
} from "./StartImport"
import { StartStepper } from "./StartStepper"
import {
	GOAL,
	LIKED,
	type StartState,
	type StartStep,
	startWords,
} from "./steps"

const keyOf = (t: { media_type: string; tmdb_id: number }) =>
	`${t.media_type}-${t.tmdb_id}`
const image = (path: string | undefined, size: string) =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
const linkButton =
	"cursor-pointer text-sm font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200"

/** How many best-known titles fill the wall behind the page. */
const WALL = 72

export function TasteStart() {
	const { locale } = useLocale()
	const revalidator = useRevalidator()
	const { data: userData } = useUserData()
	const { addScore, addSkip, isSubmitting } = useTasteScoring({
		isAuthenticated: true,
	})
	const imdbImports = useImdbImports()
	const sourceImports = useSourceImports()

	const [step, setStep] = useState<StartStep>(1)
	const [pick, setPick] = useState<ImportSourceId | null>(null)
	const [handoff, setHandoff] = useState<StartHandoff | null>(null)
	const [waitingOn, setWaitingOn] = useState<ImportSourceId | null>(null)
	const [titles, setTitles] = useState<ScoringMedia[]>([])
	const [loading, setLoading] = useState(true)
	const [done, setDone] = useState<string[]>([])
	const [rated, setRated] = useState<{ title: ScoringMedia; score: Score }[]>(
		[],
	)
	const [asked, setAsked] = useState(false)
	const [short, setShort] = useState(false)

	const handOn = (next: ImportHandoff) => {
		setStep(1)
		setWaitingOn(null)
		setPick(next.recognition.source)
		setHandoff({ ...next, count: (handoff?.count ?? 0) + 1 })
	}
	const files = useFileTaking(handOn)
	const takeFile = (file?: File) => {
		setStep(1)
		files.take(file)
	}

	// The best-known titles the member hasn't rated or skipped; more when the queue runs low.
	const scores = userData?.scores
	const scored = useMemo(() => new Set(Object.keys(scores ?? {})), [scores])
	const queue = titles.filter(
		(t) => !done.includes(keyOf(t)) && !scored.has(keyOf(t)),
	)
	const fetching = useRef(false)
	useEffect(() => {
		if (fetching.current || (titles.length > 0 && queue.length > 3)) return
		fetching.current = true
		fetchSmartTitles({
			count: titles.length === 0 ? WALL : 40,
			language: locale.language,
			excludeIds: done.map((k) => {
				const [media_type, id] = k.split("-")
				return { media_type, tmdb_id: Number(id) }
			}),
		})
			.then((more) =>
				setTitles((now) => {
					const known = new Set(now.map(keyOf))
					return [...now, ...more.filter((t) => !known.has(keyOf(t)))]
				}),
			)
			.catch(() => {})
			.finally(() => {
				fetching.current = false
				setLoading(false)
			})
	}, [titles.length, queue.length, done, locale.language])

	// Liked titles: the saved ones (imports included) with this visit's ratings on top.
	const likedKeys = useMemo(() => {
		const keys = new Set(
			Object.entries(scores ?? {})
				.filter(([, v]) => (v?.score ?? 0) >= LIKED)
				.map(([k]) => k),
		)
		for (const r of rated) {
			if (r.score >= LIKED) keys.add(keyOf(r.title))
			else keys.delete(keyOf(r.title))
		}
		return keys
	}, [scores, rated])
	const liked = likedKeys.size
	const ready = liked >= GOAL

	const imported = lastImported(
		imdbImports.data?.imports ?? [],
		sourceImports.data?.imports ?? [],
	)
	const importedFrom = [...imported.entries()].sort((a, b) =>
		b[1].localeCompare(a[1]),
	)[0]?.[0]

	// A new step starts at the stepper, not wherever the last one was scrolled to.
	const top = useRef<HTMLDivElement>(null)
	const shownStep = useRef(step)
	useEffect(() => {
		if (shownStep.current === step) return
		shownStep.current = step
		if ((top.current?.getBoundingClientRect().top ?? 0) < 0)
			top.current?.scrollIntoView({ block: "start" })
	}, [step])

	// Rating up to enough liked titles moves the member on to their taste once, a beat later, so the last rating can
	// be seen. A finished import stays on its receipt; step 1 offers "See your taste" instead.
	const movedOn = useRef(false)
	useEffect(() => {
		if (step !== 2 || !ready || movedOn.current || isSubmitting) return
		const t = setTimeout(() => {
			movedOn.current = true
			setStep(3)
		}, 1200)
		return () => clearTimeout(t)
	}, [step, ready, isSubmitting])

	// Asked for the taste and still here: the server wants a few more liked titles to find groups.
	const wasLoading = useRef(false)
	useEffect(() => {
		if (revalidator.state === "loading") wasLoading.current = true
		else if (asked && wasLoading.current) {
			wasLoading.current = false
			setAsked(false)
			setShort(true)
			movedOn.current = false
			setStep(2)
		}
	}, [revalidator.state, asked])

	const rate = (title: ScoringMedia, score: Score) => {
		addScore(title, score)
		setRated((r) => [...r, { title, score }])
		setDone((d) => [...d, keyOf(title)])
	}
	const skip = (title: ScoringMedia) => {
		addSkip(title)
		setDone((d) => [...d, keyOf(title)])
	}
	const seeTaste = () => {
		setAsked(true)
		revalidator.revalidate()
	}
	const pickSource = (id: ImportSourceId | null) => {
		setPick(id)
		setHandoff(null)
		files.clear()
	}

	const picked = pick ? sourceEntry(pick) : null
	const state: StartState = {
		step,
		liked,
		source:
			step === 1 && picked
				? { name: picked.name, connect: picked.connect }
				: undefined,
		importedFrom: importedFrom ? importSourceName(importedFrom) : undefined,
		file: !!handoff,
		short,
	}
	const words = startWords(state)
	const doneStep = (n: StartStep) =>
		n === 1 ? !!importedFrom : n === 2 ? ready && !short : false

	return (
		<div className="text-white">
			<PageDrop onFile={takeFile} />
			<PosterWall titles={titles}>
				<div
					ref={top}
					className="mx-auto flex w-full max-w-6xl scroll-mt-16 flex-col items-center gap-10 px-4 pb-32 pt-8 md:px-8 md:pt-12"
				>
					<StartStepper
						state={state}
						done={doneStep}
						canOpen={(n) => n !== 3 || ready}
						onOpen={setStep}
					/>
					<header className="max-w-3xl text-center">
						<h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
							{words.title}
						</h1>
						<p className="mx-auto mt-4 max-w-2xl text-gray-300 md:text-lg">
							{words.text}
						</p>
					</header>

					{step === 1 && (
						<div className="flex w-full max-w-5xl flex-col items-center gap-6">
							{handoff ? (
								<StartImportFlow
									handoff={handoff}
									sourceImports={sourceImports.data}
									onHandoff={handOn}
									onOther={() => pickSource(null)}
								/>
							) : (
								<>
									<StartDropZone
										sourceName={picked?.name}
										reading={files.reading}
										unknown={files.unknown}
										onFile={takeFile}
									>
										{!picked && <SourceLogoRow onPick={pickSource} />}
									</StartDropZone>
									{picked && (
										<SourceSteps
											source={picked}
											onOther={() => pickSource(null)}
											onRateMeanwhile={() => {
												setWaitingOn(picked.id)
												setStep(2)
											}}
										/>
									)}
								</>
							)}
							{ready ? (
								<button
									type="button"
									className={primaryButton}
									onClick={() => setStep(3)}
								>
									See your taste
								</button>
							) : (
								!picked &&
								!handoff && (
									<div className="mt-6 flex flex-col items-center gap-2">
										<span className="text-gray-400">
											Never tracked anything? That's fine.
										</span>
										<button
											type="button"
											className={ghostButton}
											onClick={() => setStep(2)}
										>
											Nowhere yet. I'll rate a few here
										</button>
									</div>
								)
							)}
						</div>
					)}

					{step === 2 && (
						<div className="flex w-full max-w-5xl flex-col gap-5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-3 text-sm text-gray-300">
									<RatingDots at={liked} of={GOAL} />
									{Math.min(liked, GOAL)} of {GOAL} liked
								</div>
								<button
									type="button"
									className={linkButton}
									onClick={() => setStep(1)}
								>
									I do track somewhere
								</button>
							</div>
							{waitingOn && (
								<p className="rounded-lg border border-slate-700 bg-slate-900/85 px-4 py-3 text-sm text-gray-300">
									Your {sourceEntry(waitingOn).name} file is on its way. When
									it's ready, drop it anywhere on this page.
								</p>
							)}
							<RateCard
								title={queue[0]}
								loading={loading}
								onRate={rate}
								onSkip={skip}
							/>
							{rated.length > 0 && (
								<ul
									className="flex gap-2 overflow-x-auto"
									aria-label="Rated so far"
								>
									{rated.map((r) => (
										<li key={keyOf(r.title)} className="relative w-12 shrink-0">
											<img
												src={image(r.title.poster_path, "w92")}
												alt={`${r.title.title}, ${r.score}`}
												className="rounded"
											/>
											<span
												aria-hidden
												className="absolute inset-x-0 bottom-0 bg-gray-950/80 text-center text-[11px] font-black text-amber-300"
											>
												{r.score}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					{step === 3 && (
						<div className="flex w-full flex-col items-center gap-6">
							<PosterFan
								titles={[...rated.map((r) => r.title), ...titles].filter((t) =>
									likedKeys.has(keyOf(t)),
								)}
							/>
							<div className="flex flex-wrap items-center justify-center gap-3">
								<button
									type="button"
									className={primaryButton}
									onClick={seeTaste}
									disabled={revalidator.state === "loading"}
								>
									{revalidator.state === "loading"
										? "Building your taste…"
										: "See your taste"}
								</button>
								<button
									type="button"
									className={ghostButton}
									onClick={() => setStep(2)}
								>
									Rate a few more
								</button>
							</div>
						</div>
					)}
				</div>
			</PosterWall>
		</div>
	)
}

function RateCard({
	title: x,
	loading,
	onRate,
	onSkip,
}: {
	title: ScoringMedia | undefined
	loading: boolean
	onRate: (title: ScoringMedia, score: Score) => void
	onSkip: (title: ScoringMedia) => void
}) {
	if (!x)
		return (
			<p
				className={`py-10 text-center text-gray-400 ${loading ? "animate-pulse" : ""}`}
			>
				{loading ? "Finding titles for you…" : "That's every title for now."}
			</p>
		)
	return (
		<div className="relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-gray-900 p-4 ring-1 ring-white/10 sm:flex-row md:p-6">
			{x.backdrop_path && (
				<img
					src={image(x.backdrop_path, "w1280")}
					alt=""
					className="absolute inset-0 h-full w-full object-cover opacity-20"
				/>
			)}
			<img
				src={image(x.poster_path, "w342")}
				alt=""
				className="relative w-32 shrink-0 self-start rounded-lg shadow-xl md:w-44"
			/>
			<div className="relative min-w-0 flex-1">
				<div className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
					Seen it? How was it?
				</div>
				<h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{x.title}</h2>
				<div className="mb-4 text-sm text-gray-300">
					{[x.release_year, x.genres?.slice(0, 3).join(", ")]
						.filter(Boolean)
						.join(" · ")}
				</div>
				<button
					type="button"
					className={`${ghostButton} mb-4`}
					onClick={() => onSkip(x)}
				>
					Haven't seen it
				</button>
				<ScoreControl
					key={keyOf(x)}
					onRate={(v) => onRate(x, v)}
					fit="screen"
				/>
			</div>
		</div>
	)
}

/** The best-known titles as a dim wall behind the page, fading into the page's own background. */
function PosterWall({
	titles,
	children,
}: { titles: ScoringMedia[]; children: React.ReactNode }) {
	const wall = titles.slice(0, WALL)
	const fade: CSSProperties = {
		maskImage: "linear-gradient(to bottom, black 45%, transparent)",
		WebkitMaskImage: "linear-gradient(to bottom, black 45%, transparent)",
	}
	return (
		<div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
			<div className="absolute inset-0" style={fade} aria-hidden>
				<div className="grid grid-cols-6 content-start gap-1 opacity-25 md:grid-cols-12">
					{wall.map((t) => (
						<img
							key={keyOf(t)}
							src={image(t.poster_path, "w185")}
							alt=""
							loading="lazy"
							decoding="async"
							className="aspect-[2/3] w-full object-cover"
						/>
					))}
				</div>
				<div className="absolute inset-0 bg-linear-to-b from-gray-950/40 via-gray-950/80 to-gray-950/90" />
			</div>
			<div className="relative">{children}</div>
		</div>
	)
}

/** Up to seven liked titles fanned out: what the taste is built from. */
function PosterFan({ titles }: { titles: ScoringMedia[] }) {
	const seen = new Set<string>()
	const fan = titles
		.filter((t) => !seen.has(keyOf(t)) && seen.add(keyOf(t)))
		.slice(0, 7)
	if (fan.length === 0) return null
	const mid = (fan.length - 1) / 2
	return (
		<div className="flex justify-center py-8" aria-hidden>
			{fan.map((t, i) => (
				<img
					key={keyOf(t)}
					src={image(t.poster_path, "w342")}
					alt=""
					style={{
						transform: `rotate(${(i - mid) * 5}deg) translateY(${Math.abs(i - mid) * 8}px)`,
						zIndex: 10 - Math.round(Math.abs(i - mid)),
					}}
					className="-mx-4 w-24 rounded-lg shadow-2xl ring-1 ring-white/10 md:-mx-6 md:w-44"
				/>
			))}
		</div>
	)
}
