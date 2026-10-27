// The Taste page for a member with no taste yet, in three steps under a stepper: bring your history (drop an export
// or pick where it lives), rate a few titles (the rating flow, ui/rating-flow, the same as /taste/quiz), and see the
// taste. Both paths count toward the same liked titles; once there are enough, the flow's taste bar turns amber and
// opens the last step, whose "See your taste" asks the page again so the taste takes this one's place.
import { useRevalidator } from "@remix-run/react"
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useUserData } from "~/routes/api.user-data"
import type { ImportHandoff } from "~/ui/imports/ImportFileRouting"
import {
	type ImportSourceId,
	importSourceName,
	lastImported,
} from "~/ui/imports/ImportSources"
import { useSourceImports } from "~/ui/imports/SourceImportHooks"
import { useImdbImports } from "~/ui/imports/api"
import { primaryButton } from "~/ui/imports/shared"
import type { FlowView } from "~/ui/rating-flow/flow"
import { RatingFlow } from "~/ui/rating-flow/RatingFlow"
import type { ScoringMedia } from "~/ui/scoring/types"
import useLocale from "~/utils/locale"
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
	const imdbImports = useImdbImports()
	const sourceImports = useSourceImports()

	const [step, setStep] = useState<StartStep>(1)
	const [flowView, setFlowView] = useState<FlowView>("rate")
	const [pick, setPick] = useState<ImportSourceId | null>(null)
	const [handoff, setHandoff] = useState<StartHandoff | null>(null)
	const [waitingOn, setWaitingOn] = useState<ImportSourceId | null>(null)
	// The best-known titles: the wall behind the page, and the first titles the rating step asks about.
	const [titles, setTitles] = useState<ScoringMedia[]>([])
	// The wall arrived, or won't: the rating step starts from it (its queue takes first titles only once).
	const [wallSettled, setWallSettled] = useState(false)
	// Titles met while rating, for the liked posters of the last step.
	const [met, setMet] = useState<ScoringMedia[]>([])
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

	useEffect(() => {
		let gone = false
		fetchSmartTitles({ count: WALL, language: locale.language })
			.then((wall) => {
				if (!gone) setTitles(wall)
			})
			// Without the wall the page still works: the rating step asks for its own titles.
			.catch(() => {})
			.finally(() => {
				if (!gone) setWallSettled(true)
			})
		return () => {
			gone = true
		}
	}, [locale.language])

	// Liked titles: the saved ones, imports and this visit's ratings included (a score is on the account at once).
	const scores = userData?.scores
	const likedKeys = useMemo(
		() =>
			new Set(
				Object.entries(scores ?? {})
					.filter(([, v]) => (v?.score ?? 0) >= LIKED)
					.map(([k]) => k),
			),
		[scores],
	)
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

	// Asked for the taste and still here: the server wants a few more liked titles to find groups.
	const wasLoading = useRef(false)
	useEffect(() => {
		if (revalidator.state === "loading") wasLoading.current = true
		else if (asked && wasLoading.current) {
			wasLoading.current = false
			setAsked(false)
			setShort(true)
			setFlowView("rate")
			setStep(2)
		}
	}, [revalidator.state, asked])

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
							{/* The rating flow, the same as /taste/quiz. Once the taste is ready its taste bar opens the
							    last step; before that, its own taste view. Reaching it never stops rating. */}
							{wallSettled ? (
								<RatingFlow
									titles={titles}
									member
									view={flowView}
									onView={setFlowView}
									backdrop={false}
									onOpenTaste={(flow) => {
										if (!flow.ready) return false
										setMet([...flow.met.values()])
										setStep(3)
										return true
									}}
									top={
										<div className="mb-5 flex flex-col gap-3">
											<div className="flex justify-end">
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
													Your {sourceEntry(waitingOn).name} file is on its way.
													When it's ready, drop it anywhere on this page.
												</p>
											)}
										</div>
									}
								/>
							) : (
								<p className="animate-pulse py-10 text-center text-gray-400">
									Finding titles for you…
								</p>
							)}
						</div>
					)}

					{step === 3 && (
						<div className="flex w-full flex-col items-center gap-6">
							<PosterFan
								titles={[...met, ...titles].filter((t) =>
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
									onClick={() => {
										setFlowView("rate")
										setStep(2)
									}}
								>
									Keep rating
								</button>
							</div>
						</div>
					)}
				</div>
			</PosterWall>
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
