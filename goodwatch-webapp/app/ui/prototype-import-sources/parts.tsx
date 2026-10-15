// PROTOTYPE - throwaway (#617). Pieces every variant uses: the source mark, what a source brings, the steps to get
// its file, the per-source upload box that also recognizes a wrong file, TMDB's connect, the wait for a Netflix
// archive, a source that isn't built yet, and the real preview with sample numbers.
import {
	ArrowTopRightOnSquareIcon,
	CheckCircleIcon,
	ClockIcon,
	LinkIcon,
} from "@heroicons/react/20/solid"
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { useQueryClient } from "@tanstack/react-query"
import {
	type DragEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import type { ImportItem, ImportOutcome, ImportSummary } from "~/domain/imports"
import { sourceImportKeys } from "~/ui/imports/SourceImportHooks"
import { SourceImportPreview } from "~/ui/imports/SourceImportPreview"
import {
	card,
	errorBox,
	formatDate,
	infoBox,
	primaryButton,
	secondaryButton,
	stepHeading,
	textLink,
} from "~/ui/imports/shared"
import { type Peek, peekFile } from "./peek"
import { type Recognition, SAMPLES, recognize } from "./recognize"
import {
	type Built,
	GETS_LABELS,
	type ImportRoute,
	type Source,
	type SourceId,
	isBuilt,
	sourceById,
} from "./sources"
import { useStore } from "./store"

export function SourceMark({
	source,
	size = "md",
}: { source: Source; size?: "sm" | "md" | "lg" }) {
	const box =
		size === "lg"
			? "size-14 text-lg"
			: size === "sm"
				? "size-8 text-xs"
				: "size-10 text-sm"
	return (
		<span
			aria-hidden
			className={`${box} ${source.color} flex shrink-0 items-center justify-center rounded-lg font-black tracking-tight text-white shadow-inner`}
		>
			{source.mark}
		</span>
	)
}

export function WaitBadge({ route }: { route: ImportRoute }) {
	const tone =
		route.wait === "days"
			? "border-amber-700 bg-amber-950/60 text-amber-100"
			: route.wait === "minutes"
				? "border-sky-800 bg-sky-950/60 text-sky-100"
				: "border-emerald-800 bg-emerald-950/60 text-emerald-100"
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
		>
			<ClockIcon className="size-3.5" aria-hidden />
			{route.waitText}
		</span>
	)
}

export function StatusPill({
	source,
	built,
}: { source: Source; built: Built }) {
	const store = useStore()
	if (store.waiting[source.id])
		return (
			<span className="rounded-full bg-amber-900/70 px-2 py-0.5 text-xs font-semibold text-amber-100">
				Waiting for file
			</span>
		)
	if (source.history)
		return (
			<span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-gray-200">
				Imported {source.history}
			</span>
		)
	if (!isBuilt(source, built))
		return (
			<span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs font-semibold text-gray-400">
				Coming later
			</span>
		)
	if (source.method === "connect")
		return (
			<span className="rounded-full bg-indigo-900/80 px-2 py-0.5 text-xs font-semibold text-indigo-100">
				Connect
			</span>
		)
	return null
}

export function GetsLine({
	route,
	className = "",
}: { route: ImportRoute; className?: string }) {
	return (
		<p className={`text-sm text-gray-400 ${className}`}>
			{route.gets.map((item) => GETS_LABELS[item]).join(" · ")}
		</p>
	)
}

function Step({ number, children }: { number: number; children: ReactNode }) {
	return (
		<li className="flex gap-3">
			<span
				aria-hidden
				className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-sm font-bold text-white"
			>
				{number}
			</span>
			<div className="flex min-w-0 flex-col items-start gap-2">{children}</div>
		</li>
	)
}

function ExternalLink({
	href,
	children,
}: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={secondaryButton}
		>
			{children}
			<ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden />
			<span className="sr-only">(opens in a new tab)</span>
		</a>
	)
}

/** The steps to get one route's file, with the wait and what the member gets. */
export function RouteSteps({
	source,
	route,
	compact = false,
}: { source: Source; route: ImportRoute; compact?: boolean }) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<WaitBadge route={route} />
				<span className="text-sm text-gray-400">{route.where}</span>
			</div>
			<ol className="flex flex-col gap-4">
				{route.steps.map((step, index) => (
					<Step key={step.text} number={index + 1}>
						<p>{step.text}</p>
						{step.link && !compact && (
							<ExternalLink href={step.link.href}>
								{step.link.label}
							</ExternalLink>
						)}
					</Step>
				))}
			</ol>
			<div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
				<p className="font-semibold text-gray-100">
					What GoodWatch gets from it
				</p>
				<ul className="mt-1 flex flex-wrap gap-1.5">
					{route.gets.map((item) => (
						<li
							key={item}
							className="rounded-full bg-indigo-950 px-2 py-0.5 text-indigo-100"
						>
							{GETS_LABELS[item]}
						</li>
					))}
				</ul>
				{route.misses && (
					<p className="mt-2 text-gray-400">Not in this file: {route.misses}</p>
				)}
			</div>
			{source.caveat && (
				<p className="text-sm text-gray-400">{source.caveat}</p>
			)}
		</div>
	)
}

/** Netflix has two files: one now, one in up to 30 days. The member picks; the slow one can be started and left. */
export function RoutePicker({
	source,
	chosen,
	onChoose,
}: { source: Source; chosen: number; onChoose: (index: number) => void }) {
	if (source.routes.length < 2) return null
	return (
		<fieldset>
			<legend className="mb-2 font-semibold text-gray-100">Which file?</legend>
			<div className="grid gap-2 sm:grid-cols-2">
				{source.routes.map((route, index) => (
					<label
						key={route.label}
						className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 ${chosen === index ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700 bg-slate-900/60"}`}
					>
						<span className="flex items-center gap-2">
							<input
								type="radio"
								name={`${source.id}-route`}
								checked={chosen === index}
								onChange={() => onChoose(index)}
								className="size-4 accent-indigo-500"
							/>
							<span className="font-semibold text-gray-100">{route.label}</span>
						</span>
						<span className="flex flex-wrap items-center gap-2 pl-6">
							<WaitBadge route={route} />
						</span>
						<GetsLine route={route} className="pl-6" />
					</label>
				))}
			</div>
		</fieldset>
	)
}

/** Everything for one chosen source: steps, then upload, connect, wait, or "not built yet". */
export function SourceGuide({
	source,
	built,
	upload = "box",
	headingLevel = 3,
}: {
	source: Source
	built: Built
	upload?: "box" | "none"
	headingLevel?: 3 | 4
}) {
	const store = useStore()
	const [routeIndex, setRouteIndex] = useState(0)
	const route = source.routes[routeIndex] ?? source.routes[0]
	const stage =
		store.open === source.id ? store.stage : { step: "guide" as const }
	const Heading = headingLevel === 3 ? "h3" : "h4"
	if (stage.step === "preview")
		return (
			<PreviewStage
				source={source}
				fileName={stage.fileName}
				recognized={stage.recognized}
			/>
		)
	if (!isBuilt(source, built)) return <NotBuilt source={source} />
	return (
		<div className="flex flex-col gap-5">
			<Heading className={stepHeading}>
				{source.method === "connect"
					? `Connect ${source.name}`
					: `How to get your file from ${source.name}`}
			</Heading>
			{source.method === "connect" ? (
				<ConnectFlow source={source} />
			) : (
				<>
					<RoutePicker
						source={source}
						chosen={routeIndex}
						onChoose={setRouteIndex}
					/>
					<RouteSteps source={source} route={route} />
					{route.wait === "days" && <WaitControl source={source} />}
					{upload === "box" && (
						<SourceUploadBox source={source} route={route} built={built} />
					)}
				</>
			)}
		</div>
	)
}

function WaitControl({ source }: { source: Source }) {
	const store = useStore()
	const since = store.waiting[source.id]
	return since ? (
		<div className="rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-amber-100">
			<p className="font-semibold">
				You asked {source.name} for your file on {formatDate(since)}.
			</p>
			<p className="mt-1 text-sm">
				{source.name} allows up to 30 days. Open the link in the "ready" email
				within a few days, then upload the ZIP here. Meanwhile, the quick
				viewing activity file works now, and the archive adds what it lacks.
			</p>
			<button
				type="button"
				className={`${textLink} mt-2 min-h-11 text-sm`}
				onClick={() => store.stopWait(source.id)}
			>
				I'm not waiting for it anymore
			</button>
		</div>
	) : (
		<button
			type="button"
			className={`${secondaryButton} self-start`}
			onClick={() => store.startWait(source.id)}
		>
			<ClockIcon className="size-5" aria-hidden />
			I've asked for it, remind me here
		</button>
	)
}

function NotBuilt({ source }: { source: Source }) {
	const store = useStore()
	const asked = store.notify.includes(source.id)
	const route = source.routes[0]
	return (
		<div className="flex flex-col gap-4">
			<h3 className={stepHeading}>{source.name} imports are coming later</h3>
			<p>
				GoodWatch can't read {source.name}{" "}
				{source.method === "connect" ? "accounts" : "files"} yet.{" "}
				{source.notBuiltWhy}
			</p>
			{route && (
				<div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm">
					<p className="font-semibold text-gray-100">What it will bring</p>
					<GetsLine route={route} className="mt-1" />
				</div>
			)}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className={asked ? secondaryButton : primaryButton}
					onClick={() => store.toggleNotify(source.id)}
				>
					{asked ? (
						<>
							<CheckCircleIcon className="size-5" aria-hidden /> We'll email you
							when it's ready
						</>
					) : (
						"Email me when it's ready"
					)}
				</button>
			</div>
			{source.fallback && (
				<p className="text-sm text-gray-400">{source.fallback}</p>
			)}
		</div>
	)
}

function ConnectFlow({ source }: { source: Source }) {
	const store = useStore()
	const connecting =
		store.open === source.id && store.stage.step === "connecting"
	const route = source.routes[0]
	return (
		<div className="flex flex-col gap-4">
			<p>
				No file needed. {source.name} asks you to approve GoodWatch, then
				GoodWatch reads your ratings, watchlist, and favorites once. You can
				remove the approval on {source.name} afterwards.
			</p>
			{route && <RouteSteps source={source} route={route} compact />}
			{connecting ? (
				<div className={`${infoBox} flex flex-col gap-3`}>
					<p>
						{source.name} opened in a new tab. Approve GoodWatch there, then
						come back here.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							onClick={() =>
								store.setStage({
									step: "preview",
									fileName: `Your ${source.name} account`,
								})
							}
						>
							I've approved it
						</button>
						<button
							type="button"
							className={secondaryButton}
							onClick={() => store.setStage({ step: "guide" })}
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					className={`${primaryButton} self-start`}
					onClick={() => {
						store.choose(source.id)
						store.setStage({ step: "connecting" })
					}}
				>
					<LinkIcon className="size-5" aria-hidden />
					Connect {source.name}
				</button>
			)}
			{source.alternative && (
				<p className="text-sm text-gray-400">{source.alternative}</p>
			)}
		</div>
	)
}

/** What happens when a file lands in a box: read it here, name its source, and go on or explain. */
export function useRecognizer(expected: Source | null, built: Built) {
	const store = useStore()
	const [result, setResult] = useState<{
		fileName: string
		recognition: Recognition
	} | null>(null)
	const [reading, setReading] = useState(false)
	const take = async (fileName: string, peek: Peek | Promise<Peek>) => {
		setReading(true)
		const recognition = recognize(fileName, await peek)
		setReading(false)
		setResult({ fileName, recognition })
		const found = recognition.source ? sourceById(recognition.source) : null
		if (
			found &&
			(!expected || found.id === expected.id) &&
			isBuilt(found, built) &&
			!recognition.needsChoice
		) {
			store.choose(found.id)
			store.setStage({
				step: "preview",
				fileName,
				recognized: recognition.label,
			})
		}
	}
	return {
		result,
		reading,
		take,
		reset: () => setResult(null),
		takeFile: (file: File) => take(file.name, peekFile(file)),
	}
}

export function DropZone({
	onFile,
	reading,
	label,
	accept,
	button = "Choose file",
	big = false,
}: {
	onFile: (file: File) => void
	reading: boolean
	label: string
	accept?: string
	button?: string
	big?: boolean
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const drop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setDragging(false)
		const file = event.dataTransfer.files[0]
		if (file) onFile(file)
	}
	return (
		<div
			onDragOver={(event) => {
				event.preventDefault()
				setDragging(true)
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={drop}
			className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 ${big ? "py-12" : "py-8"} text-center ${dragging ? "border-indigo-400 bg-indigo-950/60" : "border-slate-600 bg-slate-900/60"}`}
		>
			<ArrowUpTrayIcon
				className={`${big ? "size-10" : "size-8"} text-gray-500`}
				aria-hidden
			/>
			<p aria-live="polite">
				{reading ? "Reading your file. Nothing is uploaded yet." : label}
			</p>
			<button
				type="button"
				className={primaryButton}
				disabled={reading}
				onClick={() => inputRef.current?.click()}
			>
				{button}
			</button>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				className="sr-only"
				aria-label={button}
				onChange={(event) => {
					const file = event.target.files?.[0]
					if (file) onFile(file)
					event.target.value = ""
				}}
			/>
		</div>
	)
}

/** Prototype only: drop a sample file without having one. The samples are the signatures, not real files. */
export function SampleFiles({
	onSample,
	only,
}: { onSample: (fileName: string, peek: Peek) => void; only?: SourceId }) {
	const samples = SAMPLES.filter(
		(sample) => !only || sample.for === only || sample.wrong,
	)
	return (
		<details className="rounded-lg border border-dashed border-fuchsia-700/70 bg-fuchsia-950/20 p-3 text-sm">
			<summary className="cursor-pointer font-semibold text-fuchsia-200">
				Prototype: drop a sample file
			</summary>
			<div className="mt-2 flex flex-wrap gap-2">
				{samples.map((sample) => (
					<button
						key={sample.fileName}
						type="button"
						className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-left text-xs text-gray-200 hover:bg-slate-700"
						onClick={() => onSample(sample.fileName, sample.peek)}
					>
						{sample.fileName}
					</button>
				))}
			</div>
		</details>
	)
}

export function RecognitionNote({
	result,
	expected,
	built,
	onReset,
}: {
	result: { fileName: string; recognition: Recognition }
	expected: Source | null
	built: Built
	onReset: () => void
}) {
	const store = useStore()
	const { recognition, fileName } = result
	const found = recognition.source ? sourceById(recognition.source) : null
	if (
		found &&
		(!expected || found.id === expected.id) &&
		isBuilt(found, built) &&
		!recognition.needsChoice
	)
		return null
	if (recognition.needsChoice)
		return (
			<div className={`${infoBox} flex flex-col gap-3`}>
				<p>
					<span className="font-semibold">{fileName}</span> is a{" "}
					{recognition.label}. Which site did it come from?
				</p>
				<div className="flex flex-wrap gap-2">
					{recognition.needsChoice.map((id) => {
						const option = sourceById(id)
						return (
							<button
								key={id}
								type="button"
								className={secondaryButton}
								onClick={() => {
									store.choose(id)
									if (isBuilt(option, built))
										store.setStage({
											step: "preview",
											fileName,
											recognized: `${option.name} export`,
										})
								}}
							>
								{option.name}
							</button>
						)
					})}
				</div>
			</div>
		)
	if (found && !isBuilt(found, built))
		return (
			<div className={`${infoBox} flex flex-col gap-2`}>
				<p>
					<span className="font-semibold">{fileName}</span> looks like a{" "}
					{recognition.label}. GoodWatch can't read {found.name} files yet.
				</p>
				<button
					type="button"
					className={`${textLink} self-start`}
					onClick={() => store.choose(found.id)}
				>
					See what's planned for {found.name}
				</button>
			</div>
		)
	if (found && expected && found.id !== expected.id)
		return (
			<div className={`${infoBox} flex flex-col gap-3`}>
				<p>
					<span className="font-semibold">{fileName}</span> looks like a{" "}
					{recognition.label}, not a {expected.name} file.
				</p>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						className={primaryButton}
						onClick={() => {
							store.choose(found.id)
							store.setStage({
								step: "preview",
								fileName,
								recognized: recognition.label,
							})
						}}
					>
						Import it as {found.name}
					</button>
					<button type="button" className={secondaryButton} onClick={onReset}>
						Choose another file
					</button>
				</div>
			</div>
		)
	return (
		<div className={errorBox}>
			<p>
				GoodWatch doesn't recognize{" "}
				<span className="font-semibold">{fileName}</span>.{" "}
				{recognition.hint ??
					"Upload the file as the site gave it to you, without opening or renaming it."}
			</p>
		</div>
	)
}

export function SourceUploadBox({
	source,
	route,
	built,
}: { source: Source; route: ImportRoute; built: Built }) {
	const recognizer = useRecognizer(source, built)
	return (
		<section className="flex flex-col gap-3">
			<h4 className="font-semibold text-gray-100">
				Upload your {source.name} file
			</h4>
			<DropZone
				onFile={recognizer.takeFile}
				reading={recognizer.reading}
				label={`Drop ${route.fileHint} here, or choose it from your device.`}
				button={`Choose ${route.fileKind}`}
			/>
			{recognizer.result && (
				<RecognitionNote
					result={recognizer.result}
					expected={source}
					built={built}
					onReset={recognizer.reset}
				/>
			)}
			<SampleFiles
				only={source.id}
				onSample={(fileName, peek) => recognizer.take(fileName, peek)}
			/>
			<p className="text-sm text-gray-400">
				You will review everything before GoodWatch changes your library.
			</p>
		</section>
	)
}

const SAMPLE_ITEMS: Record<ImportOutcome, ImportItem[]> = {
	new: [
		{
			index: 1,
			key: "a",
			kind: "rating",
			mediaType: "movie",
			title: "Past Lives",
			year: 2023,
			tmdbId: 666277,
			imdbId: null,
			score: 9,
			outcome: "new",
			reason: null,
		},
		{
			index: 2,
			key: "b",
			kind: "watch",
			mediaType: "show",
			title: "Slow Horses",
			year: 2022,
			tmdbId: 95480,
			imdbId: null,
			season: 4,
			episode: 6,
			watchedAt: "2024-10-30T21:10:00Z",
			outcome: "new",
			reason: null,
		},
	],
	unchanged: [
		{
			index: 3,
			key: "c",
			kind: "rating",
			mediaType: "movie",
			title: "Arrival",
			year: 2016,
			tmdbId: 329865,
			imdbId: null,
			score: 8,
			outcome: "unchanged",
			reason: null,
		},
	],
	conflict: [
		{
			index: 4,
			key: "d",
			kind: "rating",
			mediaType: "movie",
			title: "Tenet",
			year: 2020,
			tmdbId: 577922,
			imdbId: null,
			score: 6,
			currentScore: 8,
			outcome: "conflict",
			reason: "GoodWatch has 8",
		},
	],
	unmatched: [
		{
			index: 5,
			key: "e",
			kind: "watch",
			mediaType: "show",
			title: "Abstract: The Art of Design: Season 2: Olafur Eliasson",
			year: null,
			tmdbId: null,
			imdbId: null,
			outcome: "unmatched",
			reason: "No title in the GoodWatch catalog has this name",
		},
	],
	unsupported: [
		{
			index: 6,
			key: "f",
			kind: "unsupported",
			mediaType: "show",
			title: "Trailer: Stranger Things 5",
			year: null,
			tmdbId: null,
			imdbId: null,
			outcome: "unsupported",
			reason: "Trailers and previews aren't watches",
		},
	],
	invalid: [],
}

function sampleSummary(source: Source, fileName: string): ImportSummary {
	// Netflix's archive adds My List and rewatches to what the quick viewing activity file has.
	const archive = source.id === "netflix" && /\.zip$/i.test(fileName)
	const sample = archive
		? {
				...source.sample,
				counts: {
					...source.sample.counts,
					new: source.sample.counts.new + 210,
				},
				kinds: { ...source.sample.kinds, watch: 1492, want: 38 },
			}
		: source.sample
	return {
		id: `prototype-${source.id}`,
		source: source.id as ImportSummary["source"],
		fileName,
		status: "preview",
		createdAt: new Date().toISOString(),
		finishedAt: null,
		counts: {
			...sample.counts,
			rows: Object.values(sample.counts).reduce((sum, n) => sum + n, 0),
		},
		kinds: sample.kinds,
		warnings: sample.warnings,
		options: null,
		processed: 0,
		total: 0,
		applied: { added: 0, updated: 0, kept: 0, failed: 0 },
		stalled: false,
		canUndo: false,
		error: null,
	}
}

/** The real preview component with sample numbers. Its row lists read sample rows from the query cache. */
function PreviewStage({
	source,
	fileName,
	recognized,
}: { source: Source; fileName: string; recognized?: string }) {
	const store = useStore()
	const client = useQueryClient()
	const summary = sampleSummary(source, fileName)
	const [started, setStarted] = useState(false)
	useEffect(() => {
		client.setQueryDefaults([...sourceImportKeys.all, "items", summary.id], {
			staleTime: Number.POSITIVE_INFINITY,
		})
		for (const outcome of Object.keys(SAMPLE_ITEMS) as ImportOutcome[])
			client.setQueryData(sourceImportKeys.items(summary.id, outcome), {
				pages: [
					{ items: SAMPLE_ITEMS[outcome], total: SAMPLE_ITEMS[outcome].length },
				],
				pageParams: [0],
			})
	}, [client, summary.id])
	if (started)
		return (
			<div className={`${card} flex flex-col gap-2`}>
				<h3 className={stepHeading}>Importing your data</h3>
				<p>
					The prototype stops here. The real import, receipt, and undo are the
					shipped ones.
				</p>
				<button
					type="button"
					className={`${textLink} self-start min-h-11`}
					onClick={() => store.choose(null)}
				>
					Back to all sources
				</button>
			</div>
		)
	return (
		<div className="flex flex-col gap-3">
			{recognized && (
				<p className="flex items-center gap-2 text-sm text-emerald-200">
					<CheckCircleIcon className="size-5" aria-hidden /> Recognized:{" "}
					{recognized}
				</p>
			)}
			<SourceImportPreview
				summary={summary}
				focus
				confirming={false}
				error={null}
				onConfirm={() => setStarted(true)}
				onBack={() => store.setStage({ step: "guide" })}
			/>
		</div>
	)
}

export function WaitingBanner() {
	const store = useStore()
	const ids = Object.keys(store.waiting) as SourceId[]
	if (ids.length === 0) return null
	return (
		<div className="flex flex-col gap-2">
			{ids.map((id) => {
				const source = sourceById(id)
				return (
					<div
						key={id}
						className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-amber-100"
					>
						<SourceMark source={source} size="sm" />
						<p className="min-w-0 flex-1 text-sm">
							<span className="font-semibold">
								Waiting for your {source.name} archive
							</span>{" "}
							since {formatDate(store.waiting[id] ?? "")}. {source.name} allows
							up to 30 days.
						</p>
						<button
							type="button"
							className={`${textLink} text-sm`}
							onClick={() => store.choose(id)}
						>
							Upload it
						</button>
					</div>
				)
			})}
		</div>
	)
}
