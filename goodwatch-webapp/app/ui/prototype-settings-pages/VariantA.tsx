// PROTOTYPE - throwaway (settings subpages). Variant A, "Tiles to pages": today's Settings tiles, each now one link to
// a full page of its own (back link, big heading, wide content). Imports is the Taste start's import step: one wide
// drop zone with the logo row inside, the picked source's steps under it, then the history. My library is a separate
// link at the end; Hidden titles live there now.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { BookOpenIcon } from "@heroicons/react/24/outline"
import { Link, useSearchParams } from "@remix-run/react"
import type { ReactNode } from "react"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { DISPLAY, MY_LIBRARY } from "~/ui/my-pages/bits"
import { regionName } from "~/utils/display-names"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { SharedBody } from "./content"
import { APPS, MEMBER, SAMPLE_POSTER, sampleFor } from "./data"
import {
	FakeCheck,
	FakeConnect,
	HISTORY,
	HistoryList,
	PageDrop,
	SourceLogoRow,
	SourceMark,
	SourceSteps,
	StartDropZone,
	sourceEntry,
	useImportStage,
} from "./imports-kit"
import { PAGES, PLink, type PageSlug, pageOf, useHref } from "./pages"
import { englishName, ownName } from "~/ui/media-preference/languages"
import { BROWSER } from "~/ui/media-preference/machine"
import { Flag, ServiceLogos, shownLanguage, usePrefs } from "./parts"
import { languageFlag } from "./pickers"

export function VariantA({ slug }: { slug: PageSlug | null }) {
	if (!slug) return <Home />
	return <Subpage slug={slug} />
}

// ---------------------------------------------------------------------------------------------------------------------
// Home

const tileClass =
	"group flex min-h-48 flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:p-6"

function Tile({ slug, className = "", children }: { slug: PageSlug; className?: string; children?: ReactNode }) {
	const page = pageOf(slug)
	if (!page) return null
	return (
		<PLink to={slug} className={`${tileClass} ${className}`}>
			<span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{page.name}</span>
			<span className="mb-4 text-sm text-gray-400">{page.hint}</span>
			<span>{children}</span>
			<span className="mt-auto pt-4 text-sm font-semibold text-amber-500 group-hover:text-amber-400">Open</span>
		</PLink>
	)
}

function Chip({ on, children }: { on: boolean; children: ReactNode }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${on ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/40" : "bg-white/[0.06] text-gray-400 ring-1 ring-white/10"}`}
		>
			<span aria-hidden className={`size-2 rounded-full ${on ? "bg-amber-400" : "bg-gray-500"}`} />
			{children}
		</span>
	)
}

function Home() {
	const p = usePrefs()
	const lang = shownLanguage(p.language, p.browserLanguage)
	const sample = sampleFor(lang)
	const last = HISTORY[0]
	const lastSource = sourceEntry(last.source)
	const past = [...new Set(HISTORY.map((h) => h.source))].map(sourceEntry)
	return (
		<div className="mx-auto max-w-6xl px-4 py-4 pb-32 md:px-8 md:py-8">
			<header className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-900 p-5 ring-1 ring-white/10 md:p-6">
				<span
					aria-hidden="true"
					className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-2xl font-black text-white uppercase md:h-20 md:w-20 md:text-3xl"
				>
					{MEMBER.handle.slice(0, 1)}
				</span>
				<div className="min-w-0 flex-1">
					<h1 className="text-sm font-normal text-gray-400">Your settings</h1>
					<p className="truncate text-2xl font-black text-white md:text-3xl">@{MEMBER.handle}</p>
					<p className="truncate text-sm text-gray-400">{MEMBER.email}</p>
				</div>
			</header>

			<div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2">
				<Tile slug="where-you-watch">
					<span className="flex items-center gap-3">
						<Flag code={p.country} className="h-8 md:h-10" />
						<span className="truncate text-2xl font-black text-white md:text-3xl">{regionName(p.country)}</span>
					</span>
					<span className="mt-1 block text-sm text-gray-400">Streaming offers and age ratings</span>
				</Tile>
				<Tile slug="language">
					<span className="flex items-center gap-3">
						<Flag code={languageFlag(lang)} className="h-8 md:h-10" />
						<span className="min-w-0">
							<span className="block truncate text-2xl font-black text-white md:text-3xl">{englishName(lang)}</span>
						</span>
					</span>
					<span className="mt-1 block text-sm text-gray-400">
						{p.language === BROWSER ? "Follows your browser" : ownName(lang)}
					</span>
					<span className="mt-4 flex items-center gap-3">
						<img src={tmdbImageUrl(SAMPLE_POSTER, "w92")} alt="" className="h-12 w-8 shrink-0 rounded object-cover shadow" />
						<span lang={sample.title.lang} dir="auto" className="min-w-0 truncate text-sm font-semibold text-gray-300">
							{sample.title.text}
						</span>
					</span>
				</Tile>
				<Tile slug="services" className="md:col-span-2 md:min-h-0">
					<span className="flex flex-wrap items-center gap-x-6 gap-y-3">
						<ServiceLogos max={12} size="h-12 w-12" />
						<span className="text-sm text-gray-400">
							{p.services.length === 1 ? "1 service" : `${p.services.length} services`} in {regionName(p.country)}
						</span>
					</span>
				</Tile>
				<Tile slug="imports">
					<span className="flex items-center gap-3">
						<span className="flex -space-x-2">
							{past.map((s) => (
								<span key={s.id} className="rounded-xl ring-4 ring-gray-950">
									<SourceMark source={s} />
								</span>
							))}
						</span>
						<span className="min-w-0">
							<span className="block font-semibold text-gray-100">
								Last: {lastSource.name}, {last.when}
							</span>
							<span className="block text-sm text-gray-400">Drop a file or connect an account</span>
						</span>
					</span>
				</Tile>
				<Tile slug="connected-apps">
					<span className="flex flex-wrap items-center gap-3">
						{APPS.map((a) => (
							<ConnectAppBadge key={a.id} app={a.app} />
						))}
						<span className="text-sm text-gray-400">{APPS.length} connected</span>
					</span>
				</Tile>
				<Tile slug="discover-privacy" className="md:col-span-2 md:min-h-0">
					<span className="flex flex-wrap gap-2">
						<Chip on>For you on</Chip>
						<Chip on>Cookies allowed</Chip>
					</span>
				</Tile>
			</div>

			<h2 className="mt-10 mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">You</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				{PAGES.filter((pg) => pg.group === "you").map((pg) => (
					<PLink
						key={pg.slug}
						to={pg.slug}
						className="group flex items-center gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white"
					>
						<pg.icon className="h-7 w-7 shrink-0 text-gray-400" aria-hidden />
						<span className="min-w-0 flex-1">
							<b className="block text-white">{pg.name}</b>
							<span className="block text-sm text-gray-400">{pg.slug === "profile" ? `@${MEMBER.handle} · goodwatch.app/u/${MEMBER.handle}` : pg.hint}</span>
						</span>
						<ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-600 group-hover:text-amber-300" aria-hidden />
					</PLink>
				))}
			</div>

			<Link
				to={MY_LIBRARY}
				prefetch="intent"
				className="group mt-10 flex items-center gap-4 rounded-2xl border border-dashed border-white/15 p-5 hover:border-white/30 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-white"
			>
				<BookOpenIcon className="h-7 w-7 shrink-0 text-amber-400" aria-hidden />
				<span className="min-w-0 flex-1">
					<b className="block text-white">My library</b>
					<span className="block text-sm text-gray-400">Your scores, lists and hidden titles live in My library.</span>
				</span>
				<ChevronRightIcon className="h-5 w-5 shrink-0 text-gray-600 group-hover:text-amber-300" aria-hidden />
			</Link>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// Subpage

function Subpage({ slug }: { slug: PageSlug }) {
	const page = pageOf(slug)
	if (!page) return null
	return (
		<div className="overflow-x-clip pb-32">
			<header className="mx-auto max-w-6xl px-4 pt-6 pb-6 md:px-8 md:pt-8">
				<PLink to="" className="-ml-1 mb-2 inline-flex min-h-8 items-center gap-0.5 rounded-lg pr-2 text-sm text-gray-400 hover:text-white">
					<ChevronLeftIcon className="h-4 w-4" aria-hidden />
					Settings
				</PLink>
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{page.name}</h1>
				<p className="mt-2 max-w-2xl text-base text-gray-400">{page.intro}</p>
			</header>
			<div className="mx-auto max-w-6xl px-4 md:px-8">{slug === "imports" ? <ImportsPage /> : <SharedBody slug={slug} />}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// Imports

function ImportsPage() {
	const href = useHref()
	const [params, setParams] = useSearchParams()
	const { stage, setStage, taking } = useImportStage()
	const connecting = params.get("source")
	const connectSource = connecting ? sourceEntry(connecting as never) : null
	const reset = () => {
		taking.clear()
		setStage({ at: "start" })
		if (connecting) {
			const next = new URLSearchParams(params)
			next.delete("source")
			setParams(next, { replace: true, preventScrollReset: true })
		}
	}
	const picked = stage.at === "source" ? sourceEntry(stage.id) : null

	let main: ReactNode
	if (connectSource?.connect && stage.at === "start") {
		main = <FakeConnect id={connectSource.id} onOther={reset} />
	} else if (stage.at === "check" || stage.at === "done") {
		main = (
			<FakeCheck
				stage={stage}
				onDone={() => setStage({ ...stage, at: "done" })}
				onOther={reset}
				onReset={reset}
			/>
		)
	} else {
		main = (
			<div className="flex flex-col gap-4">
				<StartDropZone sourceName={picked?.name} reading={taking.reading} unknown={taking.unknown} onFile={taking.take}>
					<SourceLogoRow
						onPick={(id) => setStage({ at: "source", id })}
						connectTo={(id) => `${href("imports")}&source=${id}`}
					/>
				</StartDropZone>
				{picked && <SourceSteps source={picked} onOther={reset} />}
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-12">
			<PageDrop onFile={taking.take} />
			{main}
			<section className="flex flex-col gap-3">
				<div>
					<h2 className="text-lg font-bold text-white">Brought in so far</h2>
					<p className="text-sm text-gray-400">Open a receipt to see what each import changed. Undo works on the latest one.</p>
				</div>
				<HistoryList />
			</section>
			<div className="flex max-w-3xl flex-col gap-3 text-sm text-gray-400">
				<p>
					Coming from TV Time? TV Time closed on July 15, 2026. Trakt imports a saved TV Time file: import it on Trakt, then upload your Trakt
					export here.
				</p>
				<p className="text-xs text-gray-500">
					The logos show where a file comes from; no source endorses GoodWatch. IMDb, IMDbPro, STARmeter, and all related logos are trademarks of
					IMDb.com, Inc. or its affiliates. This product uses the TMDB API but is not endorsed or certified by TMDB.
				</p>
			</div>
		</div>
	)
}
