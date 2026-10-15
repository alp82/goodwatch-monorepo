// PROTOTYPE - throwaway (#617). Four ways to offer nineteen sources on the Imports page. A, B and C give each
// source its own upload box (which still says so when a file is from another source); D has one box for all.
import {
	ArrowLeftIcon,
	ChevronDownIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
	primaryButton,
	secondaryButton,
	stepHeading,
	textLink,
} from "~/ui/imports/shared"
import {
	DropZone,
	GetsLine,
	RecognitionNote,
	SampleFiles,
	SourceGuide,
	SourceMark,
	StatusPill,
	WaitBadge,
	WaitingBanner,
	useRecognizer,
} from "./parts"
import { PageIntro, SettingsShell } from "./shell"
import {
	type Built,
	GROUPS,
	SOURCES,
	type Source,
	byPopularity,
	isBuilt,
	searchSources,
	sourceById,
} from "./sources"
import { useStore } from "./store"

function SearchField({
	value,
	onChange,
	label,
}: { value: string; onChange: (value: string) => void; label: string }) {
	return (
		<label className="relative block">
			<span className="sr-only">{label}</span>
			<MagnifyingGlassIcon
				className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-500"
				aria-hidden
			/>
			<input
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={label}
				className="min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 py-2 pl-10 pr-3 text-base text-gray-100 placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
			/>
		</label>
	)
}

const firstRoute = (source: Source) => source.routes[0]
const fastest = (source: Source) =>
	source.routes.find((route) => route.wait !== "days") ?? source.routes[0]

/* A: one searchable list; a row opens in place with its steps and its own upload box. */
export function VariantA({ built }: { built: Built }) {
	const store = useStore()
	const [query, setQuery] = useState("")
	const found = searchSources(query)
	const ready = found.filter((source) => isBuilt(source, built))
	const later = found.filter((source) => !isBuilt(source, built))
	const [showLater, setShowLater] = useState(false)
	const row = (source: Source) => {
		const open = store.open === source.id
		const route = fastest(source)
		return (
			<li key={source.id} className={open ? "bg-slate-900" : ""}>
				<button
					type="button"
					aria-expanded={open}
					onClick={() => store.choose(open ? null : source.id)}
					className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800/70"
				>
					<SourceMark source={source} />
					<span className="min-w-0 flex-1">
						<span className="flex flex-wrap items-center gap-2">
							<span className="font-semibold text-gray-100">{source.name}</span>
							<StatusPill source={source} built={built} />
						</span>
						<GetsLine route={route} className="truncate" />
					</span>
					<span className="hidden sm:block">
						{isBuilt(source, built) && <WaitBadge route={route} />}
					</span>
					<ChevronDownIcon
						className={`size-5 shrink-0 text-gray-400 ${open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
				{open && (
					<div className="border-t border-slate-800 px-3 pb-5 pt-4 sm:px-4">
						<SourceGuide source={source} built={built} />
					</div>
				)}
			</li>
		)
	}
	return (
		<SettingsShell>
			<PageIntro>
				Bring your ratings, watches, and Want to See from another site or app.
				Pick where your library is now; GoodWatch shows how to get the file and
				checks it with you before anything changes.
			</PageIntro>
			<WaitingBanner />
			<SearchField
				value={query}
				onChange={setQuery}
				label={`Search ${SOURCES.length} sources, for example Netflix or Plex`}
			/>
			<ul className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/60">
				{ready.map(row)}
			</ul>
			{later.length > 0 && (
				<section className="flex flex-col gap-2">
					{query || showLater ? (
						<>
							<h3 className="text-sm font-semibold text-gray-400">
								Coming later
							</h3>
							<ul className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/30">
								{later.map(row)}
							</ul>
						</>
					) : (
						<button
							type="button"
							className={`${textLink} min-h-11 self-start text-sm`}
							onClick={() => setShowLater(true)}
						>
							{later.length} more coming later:{" "}
							{later.map((source) => source.name).join(", ")}
						</button>
					)}
				</section>
			)}
			{found.length === 0 && (
				<p className="text-gray-400">
					No source called "{query}". If your site can save a CSV, try Any other
					site (CSV).
				</p>
			)}
		</SettingsShell>
	)
}

function useWide() {
	const [wide, setWide] = useState(true)
	useEffect(() => {
		const query = window.matchMedia("(min-width: 1024px)")
		const update = () => setWide(query.matches)
		update()
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	return wide
}

/* B: a grid of marks grouped by kind; the chosen source opens in a panel beside it, or full screen on a phone. */
export function VariantB({ built }: { built: Built }) {
	const store = useStore()
	const chosen = store.open ? sourceById(store.open) : null
	const wide = useWide()
	return (
		<SettingsShell wide>
			<PageIntro />
			<WaitingBanner />
			<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
				<div className="flex min-w-0 flex-1 flex-col gap-6">
					{GROUPS.map((group) => {
						const members = byPopularity.filter(
							(source) => source.group === group.id,
						)
						return (
							<section key={group.id} className="flex flex-col gap-2">
								<div>
									<h3 className="font-semibold text-gray-100">{group.label}</h3>
									<p className="text-sm text-gray-500">{group.detail}</p>
								</div>
								<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
									{members.map((source) => {
										const active = store.open === source.id
										const ready = isBuilt(source, built)
										return (
											<li key={source.id}>
												<button
													type="button"
													aria-pressed={active}
													onClick={() => store.choose(source.id)}
													className={`flex h-full min-h-24 w-full cursor-pointer flex-col items-center justify-start gap-1.5 rounded-lg border px-1.5 py-3 text-center ${active ? "border-indigo-500 bg-indigo-950/60" : "border-slate-700 bg-slate-900/60 hover:bg-slate-800"} ${ready ? "" : "opacity-60"}`}
												>
													<SourceMark source={source} size="lg" />
													<span className="text-sm font-semibold leading-tight text-gray-100">
														{source.name}
													</span>
													<StatusPill source={source} built={built} />
												</button>
											</li>
										)
									})}
								</ul>
							</section>
						)
					})}
				</div>
				{chosen && !wide ? (
					createPortal(
						<aside className="fixed inset-0 z-[1000] overflow-y-auto bg-gray-950 px-4 pb-16 pt-4 text-base text-gray-300">
							<div className="mb-4 flex items-center gap-3">
								<button
									type="button"
									className={secondaryButton}
									onClick={() => store.choose(null)}
								>
									<ArrowLeftIcon className="size-5" aria-hidden /> All sources
								</button>
								<SourceMark source={chosen} />
								<span className="text-lg font-bold text-gray-100">
									{chosen.name}
								</span>
							</div>
							<SourceGuide source={chosen} built={built} headingLevel={4} />
						</aside>,
						document.body,
					)
				) : chosen ? (
					<aside className="w-[26rem] shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 p-5 xl:w-[30rem]">
						<div className="mb-4 flex items-center gap-3">
							<SourceMark source={chosen} />
							<span className="text-lg font-bold text-gray-100">
								{chosen.name}
							</span>
						</div>
						<SourceGuide source={chosen} built={built} headingLevel={4} />
					</aside>
				) : (
					<aside className="hidden rounded-lg border border-dashed border-slate-700 p-5 text-gray-400 lg:block lg:w-[26rem] lg:shrink-0 xl:w-[30rem]">
						<p className="font-semibold text-gray-200">
							Choose where your library is now
						</p>
						<p className="mt-1 text-sm">
							The steps to get your file, how long it takes, and what GoodWatch
							gets from it show here.
						</p>
					</aside>
				)}
			</div>
		</SettingsShell>
	)
}

/* C: "Where are you coming from?" The six most common sources first, the rest behind "Somewhere else". */
export function VariantC({ built }: { built: Built }) {
	const store = useStore()
	const [more, setMore] = useState(false)
	const [query, setQuery] = useState("")
	const chosen = store.open ? sourceById(store.open) : null
	const step = !chosen ? 1 : store.stage.step === "preview" ? 3 : 2
	const common = byPopularity.slice(0, 6)
	const rest = searchSources(query).filter(
		(source) => !common.includes(source) || query,
	)
	return (
		<SettingsShell>
			<PageIntro>
				Bring your ratings, watches, and Want to See with you.
			</PageIntro>
			<WaitingBanner />
			<ol className="grid grid-cols-3 gap-2 text-sm" aria-label="Steps">
				{["Where from", "Get your file", "Check and import"].map(
					(label, index) => (
						<li
							key={label}
							aria-current={step === index + 1 ? "step" : undefined}
							className={`border-t-4 pt-2 ${step > index ? "border-indigo-500 text-gray-100" : "border-slate-700 text-gray-500"}`}
						>
							<span className="font-semibold">{index + 1}.</span> {label}
						</li>
					),
				)}
			</ol>
			{chosen ? (
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-3">
						<SourceMark source={chosen} size="lg" />
						<div className="min-w-0 flex-1">
							<p className="text-lg font-bold text-gray-100">{chosen.name}</p>
							<button
								type="button"
								className={`${textLink} text-sm`}
								onClick={() => store.choose(null)}
							>
								Choose another source
							</button>
						</div>
					</div>
					<SourceGuide source={chosen} built={built} />
				</div>
			) : (
				<section className="flex flex-col gap-4">
					<h3 className={stepHeading}>Where are you coming from?</h3>
					<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{common.map((source) => (
							<li key={source.id}>
								<button
									type="button"
									onClick={() => store.choose(source.id)}
									className="flex h-full min-h-28 w-full cursor-pointer flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-left hover:border-indigo-500 hover:bg-slate-800"
								>
									<span className="flex w-full items-start justify-between gap-2">
										<SourceMark source={source} />
										<StatusPill source={source} built={built} />
									</span>
									<span className="font-semibold text-gray-100">
										{source.name}
									</span>
									<span className="text-xs text-gray-400">
										{firstRoute(source).waitText}
									</span>
								</button>
							</li>
						))}
					</ul>
					{more ? (
						<div className="flex flex-col gap-3">
							<SearchField
								value={query}
								onChange={setQuery}
								label="Search the other sources"
							/>
							{GROUPS.map((group) => {
								const members = rest.filter(
									(source) => source.group === group.id,
								)
								if (members.length === 0) return null
								return (
									<div key={group.id}>
										<p className="mb-1.5 text-sm font-semibold text-gray-400">
											{group.label}
										</p>
										<ul className="flex flex-wrap gap-2">
											{members.map((source) => (
												<li key={source.id}>
													<button
														type="button"
														onClick={() => store.choose(source.id)}
														className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 py-1 pl-1 pr-3 hover:bg-slate-800 ${isBuilt(source, built) ? "text-gray-100" : "text-gray-500"}`}
													>
														<SourceMark source={source} size="sm" />
														<span className="text-sm font-semibold">
															{source.name}
														</span>
														{!isBuilt(source, built) && (
															<span className="text-xs">later</span>
														)}
													</button>
												</li>
											))}
										</ul>
									</div>
								)
							})}
						</div>
					) : (
						<button
							type="button"
							className={`${secondaryButton} self-start`}
							onClick={() => setMore(true)}
						>
							Somewhere else ({SOURCES.length - common.length} more)
						</button>
					)}
				</section>
			)}
		</SettingsShell>
	)
}

/* D: one box for every file first; "No file yet?" picks a source for its steps; connect sources sit apart. */
export function VariantD({ built }: { built: Built }) {
	const store = useStore()
	const recognizer = useRecognizer(null, built)
	const chosen = store.open ? sourceById(store.open) : null
	const previewing = chosen && store.stage.step === "preview"
	const uploadable = byPopularity.filter(
		(source) => source.method === "upload" && isBuilt(source, built),
	)
	const connectable = byPopularity.filter(
		(source) => source.method === "connect" && isBuilt(source, built),
	)
	if (previewing)
		return (
			<SettingsShell>
				<PageIntro />
				<SourceGuide source={chosen} built={built} />
			</SettingsShell>
		)
	return (
		<SettingsShell>
			<PageIntro>
				Bring your ratings, watches, and Want to See with you. Drop the file a
				site gave you; GoodWatch works out where it's from.
			</PageIntro>
			<WaitingBanner />
			<section id="one-box" className="flex flex-col gap-3">
				<DropZone
					big
					onFile={recognizer.takeFile}
					reading={recognizer.reading}
					label="Drop any export here, or choose it from your device."
					button="Choose file"
				/>
				<p className="text-sm text-gray-400">
					Reads files from {uploadable.map((source) => source.name).join(", ")}.
				</p>
				{recognizer.result && (
					<RecognitionNote
						result={recognizer.result}
						expected={null}
						built={built}
						onReset={recognizer.reset}
					/>
				)}
				<SampleFiles
					onSample={(fileName, peek) => recognizer.take(fileName, peek)}
				/>
			</section>
			{connectable.length > 0 && (
				<section className="flex flex-col gap-2">
					<h3 className="font-semibold text-gray-100">No file needed</h3>
					<ul className="flex flex-wrap gap-2">
						{connectable.map((source) => (
							<li key={source.id}>
								<button
									type="button"
									className={secondaryButton}
									onClick={() => store.choose(source.id)}
								>
									<SourceMark source={source} size="sm" /> Connect {source.name}
								</button>
							</li>
						))}
					</ul>
				</section>
			)}
			<section className="flex flex-col gap-3">
				<h3 className={stepHeading}>No file yet?</h3>
				<label className="flex flex-col gap-1">
					<span className="text-sm text-gray-400">
						Where is your library now?
					</span>
					<select
						value={store.open ?? ""}
						onChange={(event) =>
							store.choose(
								event.target.value
									? (event.target.value as Source["id"])
									: null,
							)
						}
						className="min-h-11 rounded-lg border border-slate-600 bg-slate-900 px-3 text-base text-gray-100"
					>
						<option value="">Choose a site or app</option>
						{GROUPS.map((group) => (
							<optgroup key={group.id} label={group.label}>
								{byPopularity
									.filter((source) => source.group === group.id)
									.map((source) => (
										<option key={source.id} value={source.id}>
											{source.name}
											{isBuilt(source, built) ? "" : " (coming later)"}
										</option>
									))}
							</optgroup>
						))}
					</select>
				</label>
				{chosen && (
					<div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
						<SourceGuide
							source={chosen}
							built={built}
							upload="none"
							headingLevel={4}
						/>
						{chosen.method === "upload" && isBuilt(chosen, built) && (
							<button
								type="button"
								className={`${primaryButton} mt-5`}
								onClick={() =>
									document
										.getElementById("one-box")
										?.scrollIntoView({ behavior: "smooth" })
								}
							>
								I have the file
							</button>
						)}
					</div>
				)}
			</section>
		</SettingsShell>
	)
}
