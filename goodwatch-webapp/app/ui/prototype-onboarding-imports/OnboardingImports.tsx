// PROTOTYPE - throwaway (branch prototype/onboarding-imports). Question: how should a fresh member's first page make
// "bring your own data" the easy way in, with rating titles as the fallback?
// /taste?variant=now|A|B|C|D. Everything is in memory: file recognition is the real one (it reads the file in the
// browser, nothing is uploaded), the import itself is simulated with made-up counts.
import {
	ArrowTopRightOnSquareIcon,
	ArrowUpTrayIcon,
	CheckCircleIcon,
	ClockIcon,
} from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { IMDB_EXPORTS_URL, IMDB_RATINGS_URL } from "~/domain/imdb-import"
import { IMPORT_SOURCE_UPLOAD } from "~/domain/imports"
import type { Score } from "~/server/scores.server"
import { recognizeImportFile } from "~/ui/imports/ImportFileRecognition"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
	importAsName,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import {
	primaryButton,
	secondaryButton,
	textLink,
} from "~/ui/imports/shared"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import type { ScoringMedia } from "~/ui/scoring/types"
import { RatingDots } from "~/ui/taste-quiz/TasteQuizPage"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { Round2, VARIANTS_2 } from "./OnboardingImports2"

export const VARIANTS = {
	now: "Today: rate one at a time",
	A: "Ask where first",
	B: "Two lanes",
	C: "Drop first",
	D: "Checklist",
	E: "",
	F: "",
	G: "",
	H: "",
} as const
type Variant = keyof typeof VARIANTS

export const onboardingVariant = (params: URLSearchParams) => {
	const v = params.get("variant")
	return v && v in VARIANTS ? (v as Variant) : null
}

export const GOAL = 5
export const LIKED = 7
export const keyOf = (t: { media_type: string; tmdb_id: number }) =>
	`${t.media_type}-${t.tmdb_id}`
export const image = (path: string | undefined, size: string) =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
export const ghost =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-10"

export const source = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((s) => s.id === id) as ImportSourceEntry
/** The sources most new members come from, in the order the tiles show them. */
export const TOP: ImportSourceId[] = ["letterboxd", "imdb", "trakt", "tmdb", "plex"]
export const REST = IMPORT_SOURCE_LIST.filter((s) => !TOP.includes(s.id))

// ---------------------------------------------------------------------------------------------------------------
// Simulated import

interface Counts {
	ratings: number
	liked: number
	watches: number
	wantToSee: number
}
type Phase =
	| { kind: "idle" }
	| { kind: "reading"; name: string }
	| { kind: "unknown"; name: string; hint: string }
	| { kind: "connecting"; source: ImportSourceId }
	| { kind: "checking"; source: ImportSourceId; label: string }
	| { kind: "found"; source: ImportSourceId; label: string; counts: Counts }
	| { kind: "importing"; source: ImportSourceId; counts: Counts }
	| { kind: "done"; source: ImportSourceId; counts: Counts }

const fakeCounts = (seed: number, src: ImportSourceId): Counts => {
	const ratings = 120 + (seed % 900)
	const dated = ["letterboxd", "trakt", "plex"].includes(src)
	return {
		ratings: src === "plex" ? 0 : ratings,
		liked: src === "plex" ? 0 : Math.round(ratings * 0.38),
		watches: dated ? Math.round(ratings * 1.4) : 0,
		wantToSee: src === "imdb" ? 0 : 20 + (seed % 70),
	}
}

export function useFakeImport() {
	const [phase, setPhase] = useState<Phase>({ kind: "idle" })
	const later = (ms: number, next: Phase) =>
		setTimeout(() => setPhase(next), ms)
	const check = (src: ImportSourceId, label: string, seed: number) => {
		setPhase({ kind: "checking", source: src, label })
		later(1400, { kind: "found", source: src, label, counts: fakeCounts(seed, src) })
	}
	return {
		phase,
		take: async (file?: File) => {
			if (!file) return
			setPhase({ kind: "reading", name: file.name })
			const r = await recognizeImportFile(file).catch(() => null)
			if (r?.source) check(r.source, `${importAsName(r)} · ${file.name}`, file.size)
			else
				setPhase({
					kind: "unknown",
					name: file.name,
					hint:
						r?.hint ??
						"Upload the file as the site gave it to you, without opening or renaming it.",
				})
		},
		sample: (src: ImportSourceId) =>
			check(src, `${source(src).name} · sample export (prototype)`, 737),
		connect: (src: ImportSourceId) => {
			setPhase({ kind: "connecting", source: src })
			setTimeout(
				() => check(src, `${source(src).name} account (prototype)`, 412),
				1200,
			)
		},
		confirm: () => {
			if (phase.kind !== "found") return
			setPhase({ kind: "importing", source: phase.source, counts: phase.counts })
			later(1600, { kind: "done", source: phase.source, counts: phase.counts })
		},
		reset: () => setPhase({ kind: "idle" }),
	}
}
export type FakeImport = ReturnType<typeof useFakeImport>

/** Rated titles kept in memory; liked counts toward the goal together with the import. */
export function useRatings(shelf: ScoringMedia[]) {
	const [done, setDone] = useState<string[]>([])
	const [rated, setRated] = useState<{ title: ScoringMedia; score: Score }[]>([])
	const queue = shelf.filter((t) => !done.includes(keyOf(t)))
	return {
		current: queue[0],
		rated,
		liked: rated.filter((r) => r.score >= LIKED).length,
		rate: (t: ScoringMedia, s: Score) => {
			setRated((r) => [...r, { title: t, score: s }])
			setDone((d) => [...d, keyOf(t)])
		},
		skip: (t: ScoringMedia) => setDone((d) => [...d, keyOf(t)]),
	}
}
export type Ratings = ReturnType<typeof useRatings>

/** Takes a file dropped anywhere on the page, with a full-screen hint while dragging. */
export function PageDrop({ onFile }: { onFile: (f?: File) => void }) {
	const [over, setOver] = useState(false)
	useEffect(() => {
		const enter = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) {
				e.preventDefault()
				setOver(true)
			}
		}
		const leave = (e: DragEvent) => {
			if (!e.relatedTarget) setOver(false)
		}
		const drop = (e: DragEvent) => {
			e.preventDefault()
			setOver(false)
			onFile(e.dataTransfer?.files[0])
		}
		window.addEventListener("dragover", enter)
		window.addEventListener("dragleave", leave)
		window.addEventListener("drop", drop)
		return () => {
			window.removeEventListener("dragover", enter)
			window.removeEventListener("dragleave", leave)
			window.removeEventListener("drop", drop)
		}
	}, [onFile])
	if (!over) return null
	return (
		<div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/80">
			<div className="rounded-2xl border-4 border-dashed border-indigo-300 px-10 py-12 text-center text-2xl font-extrabold text-white">
				Drop your export anywhere
				<div className="mt-2 text-base font-normal text-indigo-100">
					GoodWatch works out where it's from.
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Shared pieces, all built from today's components and classes

export function Eyebrow({ children }: { children: ReactNode }) {
	return (
		<div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400/90">
			{children}
		</div>
	)
}

export function Progress({ liked }: { liked: number }) {
	return (
		<div className="flex items-center gap-3 text-sm text-gray-400">
			<RatingDots at={liked} of={GOAL} />
			{Math.min(liked, GOAL)} of {GOAL} liked
		</div>
	)
}

export function RateCard({ r, compact = false, boxFit = false }: { r: Ratings; compact?: boolean; boxFit?: boolean }) {
	const x = r.current
	if (!x) return <p className="py-10 text-gray-400">That's every title for now.</p>
	return (
		<div>
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
					className={`relative shrink-0 self-start rounded-lg shadow-xl ${compact ? "w-24 md:w-32" : "w-32 md:w-44"}`}
				/>
				<div className="relative min-w-0 flex-1">
					<Eyebrow>Seen it? How was it?</Eyebrow>
					<h2 className="mt-1 text-2xl font-extrabold md:text-3xl">{x.title}</h2>
					<div className="mb-4 text-sm text-gray-300">
						{[x.release_year, x.genres?.slice(0, 3).join(", ")]
							.filter(Boolean)
							.join(" · ")}
					</div>
					<button type="button" className={`${ghost} mb-4`} onClick={() => r.skip(x)}>
						Haven't seen it
					</button>
					<ScoreControl key={keyOf(x)} onRate={(v) => r.rate(x, v)} fit={compact || boxFit ? "box" : "screen"} />
				</div>
			</div>
			{r.rated.length > 0 && (
				<ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Rated so far">
					{r.rated.map((it) => (
						<li key={keyOf(it.title)} className="relative w-12 shrink-0">
							<img src={image(it.title.poster_path, "w92")} alt={`${it.title.title}, ${it.score}`} className="rounded" />
							<span aria-hidden className="absolute inset-x-0 bottom-0 bg-gray-950/80 text-center text-[11px] font-black text-amber-300">
								{it.score}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export function ExternalButton({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
			{children}
			<ArrowTopRightOnSquareIcon className="size-4 shrink-0" aria-hidden />
			<span className="sr-only">(opens in a new tab)</span>
		</a>
	)
}

export function WaitChip({ s }: { s: ImportSourceEntry }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold text-gray-300">
			<ClockIcon className="size-3.5" aria-hidden />
			{s.wait}
		</span>
	)
}

/** How to get a source's data: its steps and link, or a connect button. Words come from the real import contract. */
export function GetYourData({ id, imp, short = false }: { id: ImportSourceId; imp: FakeImport; short?: boolean }) {
	const s = source(id)
	if (s.connect)
		return (
			<div className="flex flex-col items-start gap-3">
				<p>
					Connect your {s.name} account. GoodWatch reads {s.gets.join(", ").toLowerCase()}, and shows
					everything before your library changes.
				</p>
				<button type="button" className={primaryButton} onClick={() => imp.connect(id)}>
					Connect {s.name}
				</button>
			</div>
		)
	if (id === "imdb")
		return (
			<ol className="flex list-decimal flex-col gap-3 pl-5">
				<li>
					Open your ratings on IMDb and choose <b className="text-gray-100">Export</b>.{" "}
					<div className="mt-2">
						<ExternalButton href={IMDB_RATINGS_URL}>Open your IMDb ratings</ExternalButton>
					</div>
				</li>
				<li>IMDb takes a few minutes to prepare it.{short ? "" : " Rate a few titles here while you wait."}</li>
				<li>
					Download the CSV file from your exports, and drop it on this page.
					<div className="mt-2">
						<ExternalButton href={IMDB_EXPORTS_URL}>Open IMDb exports</ExternalButton>
					</div>
				</li>
			</ol>
		)
	const upload = IMPORT_SOURCE_UPLOAD[id as keyof typeof IMPORT_SOURCE_UPLOAD]
	const url = upload && "exportUrl" in upload ? upload.exportUrl : undefined
	return (
		<div className="flex flex-col items-start gap-3">
			{!short && upload?.instructions.map((line) => <p key={line}>{line}</p>)}
			{short && <p>Export your data on {s.name}, then drop the file on this page.</p>}
			{url && <ExternalButton href={url}>Open {s.name} export</ExternalButton>}
		</div>
	)
}

export function DropBox({ imp, big = false, sampleOf, children }: { imp: FakeImport; big?: boolean; sampleOf?: ImportSourceId | null; children?: ReactNode }) {
	const sampleSource = sampleOf && !source(sampleOf).connect ? sampleOf : "letterboxd"
	const input = useRef<HTMLInputElement>(null)
	const [over, setOver] = useState(false)
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
				imp.take(e.dataTransfer.files[0])
			}}
			className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 text-center ${big ? "py-14" : "py-8"} ${over ? "border-indigo-400 bg-indigo-950/60" : "border-slate-600 bg-slate-900/60"}`}
		>
			<ArrowUpTrayIcon className={`${big ? "size-12" : "size-9"} text-gray-500`} aria-hidden />
			{children ?? <p>Drop the file a site gave you, or choose it. GoodWatch works out where it's from.</p>}
			<div className="flex flex-wrap justify-center gap-2">
				<button type="button" className={primaryButton} onClick={() => input.current?.click()}>
					Choose file
				</button>
				<button type="button" className={secondaryButton} onClick={() => imp.sample(sampleSource)}>
					Try a sample file
				</button>
			</div>
			<input
				ref={input}
				type="file"
				className="sr-only"
				tabIndex={-1}
				aria-label="Choose an export file"
				onChange={(e) => {
					imp.take(e.target.files?.[0])
					e.target.value = ""
				}}
			/>
		</div>
	)
}

/** What the import is doing: reading, the preview to confirm, and the result. Null while idle. */
export function ImportStatus({ imp, shelf }: { imp: FakeImport; shelf: ScoringMedia[] }) {
	const p = imp.phase
	if (p.kind === "idle") return null
	const box = "rounded-2xl bg-gray-900 p-4 ring-1 ring-white/10 md:p-6"
	if (p.kind === "reading" || p.kind === "connecting" || p.kind === "checking")
		return (
			<div className={`${box} animate-pulse text-gray-300`} aria-live="polite">
				{p.kind === "reading" && `Reading ${p.name}. Nothing is uploaded yet.`}
				{p.kind === "connecting" && `Connecting ${source(p.source).name}…`}
				{p.kind === "checking" && `Matching titles from ${p.label}…`}
			</div>
		)
	if (p.kind === "unknown")
		return (
			<div className="border-l-8 border-red-700 bg-red-950 px-4 py-3 text-red-100" aria-live="assertive">
				GoodWatch doesn't recognize <b className="break-all">{p.name}</b>. {p.hint}{" "}
				<button type="button" className={textLink} onClick={imp.reset}>
					Try another file
				</button>
			</div>
		)
	const s = source(p.source)
	const c = p.counts
	const line = [
		c.ratings && `${c.ratings.toLocaleString()} ratings`,
		c.watches && `${c.watches.toLocaleString()} watches`,
		c.wantToSee && `${c.wantToSee} on Want to See`,
	]
		.filter(Boolean)
		.join(" · ")
	return (
		<div className={box} aria-live="polite">
			<div className="flex items-center gap-3">
				<SourceMark source={s} />
				<div className="min-w-0">
					<div className="font-bold text-gray-100">
						{p.kind === "done" ? `Imported from ${s.name}` : `Found in ${"label" in p ? p.label : s.name}`}
					</div>
					<div className="text-sm text-gray-400">{line}</div>
				</div>
				{p.kind === "done" && <CheckCircleIcon className="ml-auto size-7 shrink-0 text-emerald-400" aria-hidden />}
			</div>
			{c.liked > 0 && (
				<>
					<div className="mt-4 text-sm text-gray-300">
						{c.liked.toLocaleString()} titles you liked. These start your taste.
					</div>
					<ul className="mt-2 flex gap-1.5 overflow-hidden" aria-hidden>
						{shelf.slice(20, 34).map((t) => (
							<li key={keyOf(t)} className="w-12 shrink-0">
								<img src={image(t.poster_path, "w92")} alt="" className="rounded" />
							</li>
						))}
					</ul>
				</>
			)}
			{p.kind === "found" && (
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<button type="button" className={primaryButton} onClick={imp.confirm}>
						Import {(c.ratings || c.watches).toLocaleString()} {c.ratings ? "ratings" : "watches"}
					</button>
					<button type="button" className={textLink} onClick={imp.reset}>
						Not now
					</button>
					<span className="text-sm text-gray-400">You can undo the whole import later in Settings.</span>
				</div>
			)}
			{p.kind === "importing" && <div className="mt-4 animate-pulse text-gray-300">Adding them to your library…</div>}
		</div>
	)
}

/** Shown once 5 liked titles are in, from the import, ratings, or both. */
export function TasteReady({ liked, imported }: { liked: number; imported: boolean }) {
	return (
		<div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-gray-900 p-6 ring-1 ring-amber-400/30">
			<Eyebrow>Your taste is ready</Eyebrow>
			<h2 className="text-2xl font-extrabold md:text-3xl">
				{imported ? `Built from ${liked.toLocaleString()} titles you liked.` : "That's enough to start."}
			</h2>
			<p className="mt-2 text-gray-300">
				GoodWatch grouped what they share. In the real page, your taste takes this card's place.
			</p>
			<a href="/taste" className={`${primaryButton} mt-4`}>
				See your taste
			</a>
		</div>
	)
}

export function SourceTile({ s, active, onClick, small = false }: { s: ImportSourceEntry; active?: boolean; onClick: () => void; small?: boolean }) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={`flex cursor-pointer items-center gap-3 rounded-lg border text-left hover:bg-slate-800/70 ${small ? "px-2.5 py-1.5" : "min-h-16 px-3 py-2.5"} ${active ? "border-indigo-400 bg-slate-800" : "border-slate-700 bg-slate-900/60"}`}
		>
			<SourceMark source={s} />
			<span className="min-w-0">
				<span className="block font-semibold text-gray-100">{s.name}</span>
				{!small && <span className="line-clamp-1 text-xs text-gray-400">{s.gets.slice(0, 3).join(" · ")}</span>}
			</span>
		</button>
	)
}

export function useCombined(shelf: ScoringMedia[]) {
	const imp = useFakeImport()
	const r = useRatings(shelf)
	const imported = imp.phase.kind === "done" ? imp.phase.counts.liked : 0
	return { imp, r, imported, liked: r.liked + imported }
}

export const page = "mx-auto max-w-7xl px-4 pt-8 pb-32 text-white md:px-8 md:pt-12"

// ---------------------------------------------------------------------------------------------------------------
// A: one question first, "Where do you keep track of what you watch?" Picking a source shows its steps and the
// drop box; picking "Nowhere" goes straight to rating. Slow exports (IMDb) open the rating card beside the wait.

function VariantA({ shelf }: { shelf: ScoringMedia[] }) {
	const { imp, r, imported, liked } = useCombined(shelf)
	const [pick, setPick] = useState<ImportSourceId | "none" | null>(null)
	const [more, setMore] = useState(false)
	const ready = liked >= GOAL
	const slow = pick === "imdb" || pick === "trakt"
	const rating = pick === "none" || (pick && slow && imp.phase.kind !== "done")
	return (
		<div className={page}>
			<PageDrop onFile={imp.take} />
			<Eyebrow>Your taste</Eyebrow>
			{pick === null ? (
				<>
					<h1 className="text-2xl font-extrabold md:text-4xl">Where do you keep track of what you watch?</h1>
					<p className="mt-2 max-w-2xl text-gray-300">
						Bring it along and GoodWatch knows your taste right away. Nothing changes until you check it.
					</p>
					<div className="mt-6 grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
						{TOP.map((id) => (
							<SourceTile key={id} s={source(id)} onClick={() => setPick(id)} />
						))}
						<button
							type="button"
							onClick={() => setMore(!more)}
							className="min-h-16 cursor-pointer rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-left font-semibold text-gray-200 hover:bg-slate-800/70"
						>
							Somewhere else
							<span className="block text-xs font-normal text-gray-400">{REST.map((s) => s.name).join(", ")}</span>
						</button>
					</div>
					{more && (
						<div className="mt-2 flex max-w-3xl flex-wrap gap-2">
							{REST.map((s) => (
								<SourceTile key={s.id} small s={s} onClick={() => setPick(s.id)} />
							))}
						</div>
					)}
					<button type="button" className={`${ghost} mt-6`} onClick={() => setPick("none")}>
						Nowhere yet. I'll rate a few here
					</button>
					<p className="mt-3 text-sm text-gray-500">Already have the file? Drop it anywhere on this page.</p>
				</>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-2xl font-extrabold md:text-4xl">
							{ready
								? "Your taste is ready."
								: pick === "none"
									? "What have you loved watching?"
									: `Bring your ${source(pick).name} library`}
						</h1>
						{pick !== "none" && !ready && <WaitChip s={source(pick)} />}
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
						<Progress liked={liked} />
						<button type="button" className={`${textLink} text-sm`} onClick={() => { setPick(null); imp.reset() }}>
							{pick === "none" ? "I do track somewhere" : "Pick another source"}
						</button>
					</div>
					<div className={`mt-6 grid gap-6 ${rating && pick !== "none" ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : ""}`}>
						{pick !== "none" && (
							<div className="flex max-w-2xl flex-col gap-4 text-gray-300">
								{ready ? <TasteReady liked={liked} imported={imported > 0} /> : null}
								<ImportStatus imp={imp} shelf={shelf} />
								{imp.phase.kind === "idle" && (
									<>
										<GetYourData id={pick} imp={imp} />
										{!source(pick).connect && <DropBox imp={imp} sampleOf={pick} />}
									</>
								)}
							</div>
						)}
						{rating && !ready && (
							<div>
								{pick !== "none" && <Eyebrow>While {source(pick).name} prepares your file</Eyebrow>}
								<RateCard r={r} compact={pick !== "none"} />
							</div>
						)}
						{pick === "none" && ready && <TasteReady liked={liked} imported={false} />}
					</div>
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// B: two lanes side by side, both filling the same progress: rate on the left, bring your history on the right.

function VariantB({ shelf }: { shelf: ScoringMedia[] }) {
	const { imp, r, imported, liked } = useCombined(shelf)
	const [open, setOpen] = useState<ImportSourceId | null>(null)
	const ready = liked >= GOAL
	return (
		<div className={page}>
			<PageDrop onFile={imp.take} />
			<Eyebrow>Your taste</Eyebrow>
			<h1 className="text-2xl font-extrabold md:text-4xl">
				{ready ? "Your taste is ready." : "Show GoodWatch what you like."}
			</h1>
			<p className="mt-2 max-w-2xl text-gray-300">
				Rate {GOAL} titles you liked, or bring the ratings you already have. Both count.
			</p>
			<div className="mt-4">
				<Progress liked={liked} />
			</div>
			{ready && (
				<div className="mt-6 max-w-2xl">
					<TasteReady liked={liked} imported={imported > 0} />
				</div>
			)}
			<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				<section aria-label="Rate titles">
					<h2 className="mb-3 text-lg font-bold">Rate here</h2>
					<RateCard r={r} boxFit />
				</section>
				<section aria-label="Bring your history" className="flex flex-col gap-4 text-gray-300 lg:border-l lg:border-slate-800 lg:pl-6">
					<h2 className="text-lg font-bold text-white">Or bring your history</h2>
					<ImportStatus imp={imp} shelf={shelf} />
					{imp.phase.kind === "idle" && (
						<>
							<div className="flex flex-wrap gap-2">
								{TOP.map((id) => (
									<SourceTile key={id} small s={source(id)} active={open === id} onClick={() => setOpen(open === id ? null : id)} />
								))}
							</div>
							{open && (
								<div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
									<div className="mb-3 flex items-center gap-2 font-semibold text-gray-100">
										{source(open).name} <WaitChip s={source(open)} />
									</div>
									<GetYourData id={open} imp={imp} short />
								</div>
							)}
							<DropBox imp={imp} sampleOf={open} />
							<p className="text-sm text-gray-500">
								Also reads {REST.map((s) => s.name).join(", ")}.
							</p>
						</>
					)}
				</section>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C: the drop zone is the page. A wall of posters, one big box, sources as small "get the file" links under it.
// Rating titles is the secondary path, one button away.

function VariantC({ shelf }: { shelf: ScoringMedia[] }) {
	const { imp, r, imported, liked } = useCombined(shelf)
	const [open, setOpen] = useState<ImportSourceId | null>(null)
	const [rating, setRating] = useState(false)
	const ready = liked >= GOAL
	const wall = useMemo(() => shelf.slice(0, 24), [shelf])
	return (
		<div className="pb-32 text-white">
			<PageDrop onFile={imp.take} />
			<div className="relative overflow-hidden">
				<div className="absolute inset-0 grid grid-cols-6 gap-1 opacity-15 md:grid-cols-12" aria-hidden>
					{wall.map((t) => (
						<img key={keyOf(t)} src={image(t.poster_path, "w185")} alt="" className="aspect-[2/3] w-full object-cover" />
					))}
				</div>
				<div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/80 to-gray-950" aria-hidden />
				<div className="relative mx-auto max-w-3xl px-4 pb-12 pt-10 text-center md:pt-16">
					<Eyebrow>Your taste</Eyebrow>
					<h1 className="text-3xl font-extrabold md:text-5xl">
						{ready ? "Your taste is ready." : "Start with what you've already rated."}
					</h1>
					<p className="mx-auto mt-3 max-w-xl text-gray-300">
						Drop an export from Letterboxd, IMDb, Trakt, or six other places. GoodWatch reads it on your device first
						and shows everything before your library changes.
					</p>
					<div className="mt-6 text-left">
						{ready ? (
							<TasteReady liked={liked} imported={imported > 0} />
						) : imp.phase.kind === "idle" ? (
							<DropBox imp={imp} big sampleOf={open}>
								<p className="text-lg font-semibold text-gray-100">Drop your export here</p>
							</DropBox>
						) : (
							<ImportStatus imp={imp} shelf={shelf} />
						)}
					</div>
					{imp.phase.kind === "idle" && !ready && (
						<div className="mt-5">
							<div className="text-sm text-gray-400">Need the file? Get it from</div>
							<div className="mt-2 flex flex-wrap justify-center gap-2">
								{TOP.map((id) => (
									<SourceTile key={id} small s={source(id)} active={open === id} onClick={() => setOpen(open === id ? null : id)} />
								))}
							</div>
							{open && (
								<div className="mx-auto mt-3 max-w-xl rounded-lg border border-slate-700 bg-slate-900/90 p-4 text-left text-gray-300">
									<div className="mb-3 flex items-center gap-2 font-semibold text-gray-100">
										{source(open).name} <WaitChip s={source(open)} />
									</div>
									<GetYourData id={open} imp={imp} short />
								</div>
							)}
						</div>
					)}
				</div>
			</div>
			{!ready && (
				<div className="mx-auto mt-10 max-w-7xl px-4 md:px-8">
					{rating ? (
						<>
							<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
								<h2 className="text-xl font-extrabold">Rate {GOAL} titles you liked</h2>
								<Progress liked={liked} />
							</div>
							<RateCard r={r} />
						</>
					) : (
						<div className="flex flex-col items-center gap-3 border-t border-slate-800 pt-8 text-center">
							<p className="text-gray-400">Never tracked anything? That's fine.</p>
							<button type="button" className={ghost} onClick={() => setRating(true)}>
								Rate a few titles instead
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// D: a short checklist that names the whole start: bring your history (optional), top up with ratings, see your
// taste. The open step fills the page; a finished import skips the rating step when it already has 5 liked titles.

export function VariantD({ shelf }: { shelf: ScoringMedia[] }) {
	const { imp, r, imported, liked } = useCombined(shelf)
	const [step, setStep] = useState<1 | 2 | 3>(1)
	const [pick, setPick] = useState<ImportSourceId | null>(null)
	useEffect(() => {
		if (liked >= GOAL) setStep(3)
	}, [liked])
	const steps = [
		{ n: 1, label: "Bring your history", note: imp.phase.kind === "done" ? `${source(imp.phase.source).name} · ${imported} liked` : "Optional · fastest" },
		{ n: 2, label: `Rate until ${GOAL} liked`, note: `${Math.min(liked, GOAL)} of ${GOAL}` },
		{ n: 3, label: "See your taste", note: liked >= GOAL ? "Ready" : "" },
	] as const
	return (
		<div className={page}>
			<PageDrop onFile={(f) => { setStep(1); imp.take(f) }} />
			<div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]">
				<nav aria-label="Getting started">
					<Eyebrow>Get started</Eyebrow>
					<ol className="mt-2 flex gap-2 overflow-x-auto md:flex-col">
						{steps.map((s) => {
							const done = s.n < step || (s.n === 1 && imp.phase.kind === "done") || (s.n === 2 && liked >= GOAL)
							return (
								<li key={s.n} className="shrink-0">
									<button
										type="button"
										onClick={() => setStep(s.n)}
										aria-current={step === s.n ? "step" : undefined}
										className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left ${step === s.n ? "bg-slate-800 ring-1 ring-indigo-400" : "hover:bg-slate-900"}`}
									>
										<span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-600" : "bg-indigo-800"}`}>
											{done ? "✓" : s.n}
										</span>
										<span>
											<span className="block font-semibold">{s.label}</span>
											{s.note && <span className="block text-xs text-gray-400">{s.note}</span>}
										</span>
									</button>
								</li>
							)
						})}
					</ol>
				</nav>
				<div className="min-w-0 max-w-3xl text-gray-300">
					{step === 1 && (
						<div className="flex flex-col gap-4">
							<h1 className="text-2xl font-extrabold text-white md:text-4xl">Bring your history</h1>
							<p>If you rate or log what you watch somewhere, start from that. It's the fastest way to a taste that fits.</p>
							<ImportStatus imp={imp} shelf={shelf} />
							{imp.phase.kind === "idle" && (
								<>
									<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
										{IMPORT_SOURCE_LIST.map((s) => (
											<SourceTile key={s.id} s={s} active={pick === s.id} onClick={() => setPick(pick === s.id ? null : s.id)} />
										))}
									</div>
									{pick && (
										<div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
											<div className="mb-3 flex items-center gap-2 font-semibold text-gray-100">
												{source(pick).name} <WaitChip s={source(pick)} />
											</div>
											<GetYourData id={pick} imp={imp} />
										</div>
									)}
									{!(pick && source(pick).connect) && <DropBox imp={imp} sampleOf={pick} />}
								</>
							)}
							<div className="flex flex-wrap gap-3">
								<button type="button" className={ghost} onClick={() => setStep(2)}>
									{imp.phase.kind === "done" ? "Continue" : "Skip, I'll rate here"}
								</button>
							</div>
						</div>
					)}
					{step === 2 && (
						<div className="flex flex-col gap-4">
							<h1 className="text-2xl font-extrabold text-white md:text-4xl">
								{liked === 0 ? "What have you loved watching?" : `${Math.max(GOAL - liked, 0)} more you liked.`}
							</h1>
							<Progress liked={liked} />
							<RateCard r={r} />
						</div>
					)}
					{step === 3 && <TasteReady liked={liked} imported={imported > 0} />}
				</div>
			</div>
		</div>
	)
}

// Today's page (TasteStart), copied with in-memory ratings so the prototype never saves a score.
function VariantNow({ shelf }: { shelf: ScoringMedia[] }) {
	const r = useRatings(shelf)
	const left = Math.max(GOAL - r.liked, 0)
	return (
		<div className={page}>
			<Eyebrow>Your taste</Eyebrow>
			<h1 className="text-2xl font-extrabold md:text-4xl">
				{r.liked === 0 ? "What have you loved watching?" : left > 0 ? `${left} more you liked.` : "Almost there. A few more you liked."}
			</h1>
			<p className="mt-2 max-w-2xl text-gray-300">
				Rate {GOAL} titles you liked. GoodWatch groups what they share and finds more like them.
			</p>
			<div className="mt-4">
				<Progress liked={r.liked} />
			</div>
			<div className="pt-6">{left > 0 ? <RateCard r={r} /> : <TasteReady liked={r.liked} imported={false} />}</div>
		</div>
	)
}

export function OnboardingImportsPrototype({ variant, shelf }: { variant: Variant; shelf: ScoringMedia[] }) {
	return (
		<>
			{variant === "now" && <VariantNow shelf={shelf} />}
			{variant === "A" && <VariantA shelf={shelf} />}
			{variant === "B" && <VariantB shelf={shelf} />}
			{variant === "C" && <VariantC shelf={shelf} />}
			{variant === "D" && <VariantD shelf={shelf} />}
			{["E", "F", "G", "H"].includes(variant) && <Round2 variant={variant as "E"} shelf={shelf} />}
			{/* Round 2 is on the bar; round 1's now, A, B, C still open by address. */}
			<PrototypeSwitcher variants={variant in VARIANTS_2 ? VARIANTS_2 : VARIANTS} />
		</>
	)
}
