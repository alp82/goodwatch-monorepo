// PROTOTYPE - throwaway (settings subpages). Variant C, "Chapters": Settings as chapters (Watching, Your data, You),
// each setting one full-width band link with a big live preview on its right. A subpage opens with a hero band that
// repeats that preview, so a change below shows at the top at once, and ends with a pager to the previous and next
// setting. Imports is a guided three-step flow in the Taste start's stepper look. Nothing saves.
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { BookOpenIcon } from "@heroicons/react/24/outline"
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect } from "react"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { DISPLAY } from "~/ui/my-pages/bits"
import { regionName } from "~/utils/display-names"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { SharedBody } from "./content"
import { APPS, MEMBER, SAMPLE_POSTER, sampleFor } from "./data"
import {
	FakeCheck,
	FakeConnect,
	HISTORY,
	HistoryList,
	type ImportStage,
	PageDrop,
	SourceLogoRow,
	SourceMark,
	SourceSteps,
	StartDropZone,
	sourceEntry,
	useImportStage,
} from "./imports-kit"
import { PAGES, PLink, type PageInfo, type PageSlug, pageOf, useHref } from "./pages"
import { Flag, ServiceLogos, languageLabel, shownLanguage, usePrefs } from "./parts"

const WRAP = "mx-auto w-full max-w-6xl px-4 md:px-8"

const CHAPTERS: { group: PageInfo["group"]; title: string; line: string }[] = [
	{ group: "watching", title: "Watching", line: "Where you watch, what titles are called, and how Discover orders them" },
	{ group: "data", title: "Your data", line: "What you brought in, and the assistants that can reach it" },
	{ group: "you", title: "You", line: "Your public name and how you sign in" },
]

// ---------------------------------------------------------------------------------------------------------------------
// Live previews: one per setting, at two sizes. The band on the Settings page and the subpage's hero share them.

function Preview({ slug, big = false }: { slug: PageSlug; big?: boolean }) {
	const p = usePrefs()
	switch (slug) {
		case "where-you-watch":
			return (
				<span className="flex flex-col items-start gap-3 md:items-end">
					<span className="flex items-center gap-3">
						<Flag code={p.country} className={big ? "h-12 md:h-14" : "h-8"} />
						<span className={`${big ? "text-3xl md:text-4xl" : "text-xl md:text-2xl"} font-black text-white`}>{regionName(p.country)}</span>
					</span>
					<ServiceLogos max={big ? 8 : 5} size={big ? "h-11 w-11" : "h-9 w-9"} />
				</span>
			)
		case "language": {
			const sample = sampleFor(shownLanguage(p.language, p.browserLanguage))
			return (
				<span className="flex items-center gap-4">
					<img
						src={tmdbImageUrl(SAMPLE_POSTER, "w154")}
						alt=""
						className={`${big ? "h-36 w-24" : "h-24 w-16"} shrink-0 rounded-md object-cover shadow-lg ring-1 ring-white/10`}
					/>
					<span className="min-w-0">
						<span lang={sample.title.lang} dir="auto" className={`line-clamp-2 font-black text-white ${big ? "text-2xl md:text-3xl" : "text-lg md:text-xl"}`}>
							{sample.title.text}
						</span>
						<span className="mt-1 block text-sm text-gray-400">{languageLabel(p.language, p.browserLanguage)}</span>
					</span>
				</span>
			)
		}
		case "discover-privacy":
			return (
				<span className="flex flex-wrap gap-2">
					<Chip on>For you is on</Chip>
					<Chip on>Cookies allowed</Chip>
				</span>
			)
		case "imports":
			return (
				<span className="flex items-center gap-4">
					<span className="flex -space-x-2">
						{HISTORY.map((h) => (
							<span key={h.id} className="rounded-xl ring-4 ring-gray-950">
								<SourceMark source={sourceEntry(h.source)} />
							</span>
						))}
					</span>
					<span>
						<span className={`block font-black text-white ${big ? "text-3xl" : "text-xl"}`}>{HISTORY.length} imports</span>
						<span className="block text-sm text-gray-400">Last on {HISTORY[0].when}</span>
					</span>
				</span>
			)
		case "connected-apps":
			return (
				<span className="flex items-center gap-3">
					{APPS.map((a) => (
						<ConnectAppBadge key={a.id} app={a.app} size={big ? "md" : "sm"} />
					))}
					<span className="text-sm text-gray-400">{APPS.length} connected</span>
				</span>
			)
		case "profile":
			return (
				<span className="flex items-center gap-3">
					<span
						aria-hidden
						className={`flex shrink-0 items-center justify-center rounded-full bg-indigo-800 font-black text-white uppercase ${big ? "size-16 text-2xl" : "size-11 text-lg"}`}
					>
						{MEMBER.handle.slice(0, 1)}
					</span>
					<span>
						<span className={`block font-black text-white ${big ? "text-3xl" : "text-xl"}`}>@{MEMBER.handle}</span>
						<span className="block text-sm text-gray-400">goodwatch.app/u/{MEMBER.handle}</span>
					</span>
				</span>
			)
		case "account":
			return (
				<span className="flex flex-col items-start gap-2 md:items-end">
					<span className={`font-bold text-white ${big ? "text-xl" : ""}`}>{MEMBER.email}</span>
					<span className="flex gap-2">
						<Chip on>Email and password</Chip>
						<Chip on>Google</Chip>
					</span>
				</span>
			)
	}
}

function Chip({ on, children }: { on?: boolean; children: ReactNode }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${on ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30" : "bg-white/5 text-gray-400 ring-1 ring-white/10"}`}
		>
			{on && <CheckIcon className="size-4" aria-hidden />}
			{children}
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// The Settings page.

function Band({ page }: { page: PageInfo }) {
	const Icon = page.icon
	return (
		<PLink
			to={page.slug}
			className="group flex flex-col gap-5 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:flex-row md:items-center md:gap-8 md:p-6"
		>
			<span className="flex min-w-0 items-start gap-4 md:w-80 md:shrink-0">
				<Icon className="mt-0.5 size-7 shrink-0 text-amber-400" aria-hidden />
				<span className="min-w-0">
					<span className="block text-lg font-bold text-white">{page.name}</span>
					<span className="block text-sm text-gray-400">{page.hint}</span>
				</span>
			</span>
			<span className="flex min-w-0 flex-1 md:justify-end">
				<Preview slug={page.slug} />
			</span>
			<ChevronRightIcon className="hidden size-6 shrink-0 text-gray-600 group-hover:text-amber-300 md:block" aria-hidden />
		</PLink>
	)
}

function Home() {
	return (
		<div className={`${WRAP} flex flex-col gap-12 pb-28 pt-6 md:pt-10`}>
			<header className="flex flex-wrap items-end gap-4">
				<div className="min-w-0">
					<p className="text-sm text-gray-400">Your settings</p>
					<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>Settings</h1>
					<p className="mt-1 text-sm text-gray-400">
						Signed in as @{MEMBER.handle} · {MEMBER.email}
					</p>
				</div>
			</header>
			{CHAPTERS.map((chapter, i) => (
				<section key={chapter.group} aria-labelledby={`c-${chapter.group}`} className="flex flex-col gap-3">
					<div className="flex items-baseline gap-3 border-b border-white/10 pb-3">
						<span className="text-sm font-black tabular-nums text-amber-400">0{i + 1}</span>
						<h2 id={`c-${chapter.group}`} className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
							{chapter.title}
						</h2>
						<span className="hidden text-sm text-gray-500 md:inline">{chapter.line}</span>
					</div>
					{PAGES.filter((p) => p.group === chapter.group).map((page) => (
						<Band key={page.slug} page={page} />
					))}
				</section>
			))}
			<Link
				to="/my-library"
				prefetch="intent"
				className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-900 p-5 ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none md:p-6"
			>
				<BookOpenIcon className="size-8 shrink-0 text-amber-400" aria-hidden />
				<span className="min-w-0 flex-1">
					<span className="block text-lg font-bold text-white">My library</span>
					<span className="block text-sm text-gray-400">Your scores, Want to see, Seen, lists and hidden titles</span>
				</span>
				<ChevronRightIcon className="size-6 shrink-0 text-gray-500 group-hover:text-amber-300" aria-hidden />
			</Link>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// A subpage: hero with the live preview, body, pager.

function Hero({ page }: { page: PageInfo }) {
	const href = useHref()
	return (
		<div className="border-b border-white/10 bg-gradient-to-br from-indigo-950/70 via-gray-900 to-gray-950">
			<div className={`${WRAP} flex flex-col gap-6 py-6 md:flex-row md:items-end md:py-10`}>
				<div className="min-w-0 flex-1">
					<Link
						to={href()}
						prefetch="intent"
						className="-ml-1 mb-2 inline-flex min-h-8 items-center gap-0.5 rounded-lg pr-2 text-sm text-gray-400 hover:text-white"
					>
						<ChevronLeftIcon className="size-4" aria-hidden />
						Settings
					</Link>
					<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{page.name}</h1>
					<p className="mt-2 max-w-prose text-sm text-gray-300 md:text-base">{page.intro}</p>
				</div>
				{page.slug !== "imports" && (
					<div className="shrink-0 rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
						<Preview slug={page.slug} big />
					</div>
				)}
			</div>
		</div>
	)
}

function Pager({ slug }: { slug: PageSlug }) {
	const i = PAGES.findIndex((p) => p.slug === slug)
	const prev = PAGES[(i - 1 + PAGES.length) % PAGES.length]
	const next = PAGES[(i + 1) % PAGES.length]
	const box =
		"group flex min-w-0 flex-1 flex-col gap-1 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white"
	return (
		<nav aria-label="Other settings" className="mt-16 flex flex-col gap-3 sm:flex-row">
			<PLink to={prev.slug} className={box}>
				<span className="flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
					<ChevronLeftIcon className="size-4" aria-hidden /> Previous setting
				</span>
				<span className="font-bold text-white group-hover:text-amber-300">{prev.name}</span>
			</PLink>
			<PLink to={next.slug} className={`${box} sm:items-end sm:text-right`}>
				<span className="flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
					Next setting <ChevronRightIcon className="size-4" aria-hidden />
				</span>
				<span className="font-bold text-white group-hover:text-amber-300">{next.name}</span>
			</PLink>
		</nav>
	)
}

function Subpage({ slug }: { slug: PageSlug }) {
	const page = pageOf(slug) as PageInfo
	return (
		<div className="pb-28">
			<Hero page={page} />
			<div className={`${WRAP} pt-8 md:pt-10`}>
				{slug === "imports" ? <ImportsFlow /> : <SharedBody slug={slug} />}
				<Pager slug={slug} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// Imports: pick a source, get the file, check and import. The Taste start's stepper look, with its own steps.

const STEPS = ["Pick a source", "Get your file", "Check and import"] as const
type Step = 1 | 2 | 3

const stepOf = (stage: ImportStage): Step => (stage.at === "start" ? 1 : stage.at === "source" ? 2 : 3)

function Stepper({ step, finished, onOpen }: { step: Step; finished: boolean; onOpen: (n: Step) => void }) {
	return (
		<nav aria-label="Import steps" className="mx-auto w-full max-w-3xl">
			<div className="relative">
				<div aria-hidden className="absolute inset-x-[16.66%] top-[22px] h-1 overflow-hidden rounded-full bg-white/15">
					<div
						className="h-full origin-left rounded-full bg-linear-to-r from-amber-500 to-amber-300 transition-transform duration-700 ease-out"
						style={{ transform: `scaleX(${(step - 1) / 2})` }}
					/>
				</div>
				<ol className="relative grid grid-cols-3">
					{([1, 2, 3] as const).map((n) => {
						const on = step === n && !finished
						const done = n < step || (finished && n === 3)
						return (
							<li key={n} className="flex flex-col items-center text-center">
								<button
									type="button"
									onClick={() => onOpen(n)}
									disabled={n >= step}
									aria-current={on ? "step" : undefined}
									aria-label={`Step ${n}: ${STEPS[n - 1]}${done ? ", done" : ""}`}
									className={`flex size-12 cursor-pointer items-center justify-center rounded-full text-base font-black ring-4 transition-transform duration-300 disabled:cursor-default ${on ? "scale-110" : ""} ${done ? "bg-amber-400 text-gray-950 ring-gray-950" : on ? "bg-gray-950 text-amber-300 shadow-[0_0_0_8px_var(--color-gray-950)] ring-amber-400" : "bg-gray-900 text-gray-400 ring-gray-950"}`}
								>
									{done ? <CheckIcon className="size-6" aria-hidden /> : n}
								</button>
								<span className={`mt-3 text-sm font-bold md:text-base ${on ? "text-white" : "text-gray-400"}`}>{STEPS[n - 1]}</span>
							</li>
						)
					})}
				</ol>
			</div>
		</nav>
	)
}

function ImportsFlow() {
	const { stage, setStage, taking } = useImportStage()
	const step = stepOf(stage)
	const reset = () => setStage({ at: "start" })
	const pickSource = (id: ImportSourceIdLike) => setStage({ at: "source", id })
	const href = useHref()
	// A connect source picked in the logo row comes back as ?source=: open its step.
	const [params] = useSearchParams()
	const asked = params.get("source")
	useEffect(() => {
		if (asked) setStage({ at: "source", id: asked as ImportSourceIdLike })
	}, [asked, setStage])
	return (
		<div className="flex flex-col gap-10">
			<PageDrop onFile={taking.take} />
			<Stepper
				step={step}
				finished={stage.at === "done"}
				onOpen={(n) => {
					if (n === 1) reset()
					if (n === 2 && "id" in stage) setStage({ at: "source", id: stage.id })
				}}
			/>
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
				{stage.at === "start" && (
					<StartDropZone reading={taking.reading} unknown={taking.unknown} onFile={taking.take}>
						<SourceLogoRow onPick={pickSource} connectTo={(id) => `${href("imports")}&source=${id}`} prompt="No file yet? Pick where your library is now" />
					</StartDropZone>
				)}
				{stage.at === "source" &&
					(sourceEntry(stage.id).connect ? (
						<FakeConnect id={stage.id} onOther={reset} />
					) : (
						<>
							<SourceSteps source={sourceEntry(stage.id)} onOther={reset} />
							<StartDropZone sourceName={sourceEntry(stage.id).name} reading={taking.reading} unknown={taking.unknown} onFile={taking.take} />
						</>
					))}
				{(stage.at === "check" || stage.at === "done") && (
					<FakeCheck stage={stage} onDone={() => setStage({ ...stage, at: "done" })} onOther={reset} onReset={reset} />
				)}
			</div>
			<section aria-labelledby="c-earlier" className="mx-auto flex w-full max-w-3xl flex-col gap-3">
				<h2 id="c-earlier" className="text-lg font-bold text-white">
					Earlier imports
				</h2>
				<HistoryList />
				<p className="mt-2 text-sm text-gray-400">
					Coming from TV Time? TV Time closed on July 15, 2026. Import your saved TV Time file on Trakt, then bring your Trakt export here.
				</p>
				<p className="text-xs text-gray-500">
					The logos show where a file comes from; no source endorses GoodWatch. IMDb, IMDbPro, STARmeter, and all related logos are trademarks of
					IMDb.com, Inc. or its affiliates. This product uses the TMDB API but is not endorsed or certified by TMDB.
				</p>
			</section>
		</div>
	)
}

type ImportSourceIdLike = Extract<ImportStage, { at: "source" }>["id"]

export function VariantC({ slug }: { slug: PageSlug | null }) {
	return slug ? <Subpage key={slug} slug={slug} /> : <Home />
}
