// PROTOTYPE - throwaway (settings subpages). Variant B, "Side list": on a wide screen a sticky list of every setting
// stays on the left, each row one link with a live one-line summary, and the open page fills the right. On a phone the
// list is the Settings page itself, and a subpage opens on its own with a way back. Imports puts the Taste start's
// drop zone and logo row in the main column and the import history as a timeline beside it.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { BookOpenIcon } from "@heroicons/react/24/outline"
import { Link, useNavigate, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import { regionName } from "~/utils/display-names"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { SharedBody } from "./content"
import { APPS, MEMBER, SAMPLE_POSTER, sampleFor } from "./data"
import {
	FakeCheck,
	FakeConnect,
	HISTORY,
	type ImportSourceId,
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

const GROUPS: { key: PageInfo["group"]; name: string }[] = [
	{ key: "watching", name: "Watching" },
	{ key: "data", name: "Your data" },
	{ key: "you", name: "You" },
]

/** The live one-line summary of each setting, for its row in the list. */
function useSummary(): Record<PageSlug, ReactNode> {
	const p = usePrefs()
	return {
		"where-you-watch": (
			<span className="flex items-center gap-1.5">
				<Flag code={p.country} className="h-2.5" />
				{regionName(p.country)} · {p.services.length} {p.services.length === 1 ? "service" : "services"}
			</span>
		),
		language: languageLabel(p.language, p.browserLanguage),
		"discover-privacy": "For you on · Cookies allowed",
		imports: `Last import ${HISTORY[0].when.replace(", 2026", "")}`,
		"connected-apps": `${APPS.length} apps`,
		profile: `@${MEMBER.handle}`,
		account: "Email and Google",
	}
}

function Rail({ current, phone = false }: { current: PageSlug | null; phone?: boolean }) {
	const summary = useSummary()
	return (
		<nav aria-label="Settings" className="flex flex-col gap-5">
			<div className="flex items-center gap-3 px-1">
				<span
					aria-hidden
					className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-lg font-black text-white uppercase"
				>
					{MEMBER.handle.slice(0, 1)}
				</span>
				<span className="min-w-0">
					<span className="block truncate font-bold text-white">@{MEMBER.handle}</span>
					<span className="block truncate text-sm text-gray-400">{MEMBER.email}</span>
				</span>
			</div>
			{GROUPS.map((group) => (
				<section key={group.key} className="flex flex-col gap-1">
					<h2 className="px-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">{group.name}</h2>
					<ul className={`flex flex-col ${phone ? "overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 divide-y divide-white/5" : "gap-0.5"}`}>
						{PAGES.filter((page) => page.group === group.key).map((page) => {
							const on = page.slug === current
							const Icon = page.icon
							return (
								<li key={page.slug}>
									<PLink
										to={page.slug}
										aria-current={on ? "page" : undefined}
										className={`group relative flex min-h-14 items-center gap-3 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-white ${phone ? "hover:bg-white/[0.06]" : "rounded-xl hover:bg-white/[0.06]"} ${on ? "bg-white/[0.08]" : ""}`}
									>
										{on && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-amber-400" />}
										<Icon className={`size-5 shrink-0 ${on ? "text-amber-300" : "text-gray-400"}`} aria-hidden />
										<span className="min-w-0 flex-1">
											<span className={`block text-sm font-semibold ${on ? "text-white" : "text-gray-100"}`}>{page.name}</span>
											<span className="block truncate text-xs text-gray-400">{summary[page.slug]}</span>
										</span>
										<ChevronRightIcon className="size-4 shrink-0 text-gray-600 group-hover:text-amber-300" aria-hidden />
									</PLink>
								</li>
							)
						})}
					</ul>
				</section>
			))}
			<Link
				to="/my-library"
				prefetch="intent"
				className="group flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-white/15 px-3 py-2.5 hover:border-white/30 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-white"
			>
				<BookOpenIcon className="size-5 shrink-0 text-gray-400" aria-hidden />
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-semibold text-gray-100">My library</span>
					<span className="block truncate text-xs text-gray-400">Scores, lists and hidden titles</span>
				</span>
				<ChevronRightIcon className="size-4 shrink-0 text-gray-600 group-hover:text-amber-300" aria-hidden />
			</Link>
		</nav>
	)
}

/** A big card on the desktop overview: one link. */
function Card({ to, label, children, className = "" }: { to: PageSlug; label: string; children: ReactNode; className?: string }) {
	const page = pageOf(to) as PageInfo
	return (
		<PLink
			to={to}
			className={`group flex min-h-48 flex-col rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none ${className}`}
		>
			<span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</span>
			<span className="mb-4 text-sm text-gray-400">{page.hint}</span>
			<span className="mt-auto">{children}</span>
			<span className="mt-4 text-sm font-semibold text-amber-500 group-hover:text-amber-400">Open {page.name}</span>
		</PLink>
	)
}

function Overview() {
	const p = usePrefs()
	const sample = sampleFor(shownLanguage(p.language, p.browserLanguage))
	return (
		<div className="flex flex-col gap-6">
			<header>
				<h1 className={`${DISPLAY} text-4xl text-white`}>Your settings</h1>
				<p className="mt-1 text-sm text-gray-400">Pick a setting on the left. The two you change most are here too.</p>
			</header>
			<div className="grid gap-4 lg:grid-cols-2">
				<Card to="where-you-watch" label="Where you watch">
					<span className="flex items-center gap-3">
						<Flag code={p.country} className="h-9" />
						<span className="text-3xl font-black text-white">{regionName(p.country)}</span>
					</span>
					<span className="mt-4 block">
						<ServiceLogos max={7} size="h-10 w-10" />
					</span>
				</Card>
				<Card to="language" label="Show titles in">
					<span className="flex gap-4">
						<img src={tmdbImageUrl(SAMPLE_POSTER, "w154")} alt="" className="h-28 w-[4.7rem] shrink-0 rounded-md object-cover shadow-lg" />
						<span className="min-w-0">
							<span lang={sample.title.lang} dir="auto" className="line-clamp-2 text-2xl font-black text-white">
								{sample.title.text}
							</span>
							<span className="mt-1 block text-sm text-gray-400">{languageLabel(p.language, p.browserLanguage)}</span>
						</span>
					</span>
				</Card>
			</div>
			<PLink
				to="imports"
				className="group flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-950 via-gray-900 to-gray-900 p-5 ring-1 ring-white/10 hover:ring-white/20 focus-visible:outline-2 focus-visible:outline-white"
			>
				<span className="flex -space-x-2" aria-hidden>
					{(["imdb", "letterboxd", "trakt", "tmdb", "plex"] as ImportSourceId[]).map((id) => (
						<span key={id} className="rounded-lg ring-2 ring-gray-950">
							<SourceMark source={sourceEntry(id)} />
						</span>
					))}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block font-bold text-white">Bring your library from another site</span>
					<span className="block text-sm text-gray-400">
						Last import: {sourceEntry(HISTORY[0].source).name}, {HISTORY[0].when}
					</span>
				</span>
				<span className="text-sm font-semibold text-amber-500 group-hover:text-amber-400">Open Imports</span>
			</PLink>
		</div>
	)
}

function PageHeading({ page }: { page: PageInfo }) {
	return (
		<header className="mb-8">
			<PLink
				to=""
				className="-ml-1 mb-2 inline-flex min-h-8 items-center gap-0.5 rounded-lg pr-2 text-sm text-gray-400 hover:text-white md:hidden"
			>
				<ChevronLeftIcon className="size-4" aria-hidden />
				Settings
			</PLink>
			<h1 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>{page.name}</h1>
			<p className="mt-2 max-w-prose text-sm text-gray-400">{page.intro}</p>
		</header>
	)
}

/** True on a phone, where the logo row needs the full width outside the drop zone's padding. */
function useNarrow() {
	const [narrow, setNarrow] = useState(false)
	useEffect(() => {
		const query = window.matchMedia("(max-width: 480px)")
		const update = () => setNarrow(query.matches)
		update()
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	return narrow
}

function ImportsPage() {
	const { stage, setStage, taking } = useImportStage()
	const narrow = useNarrow()
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const href = useHref()
	const connectId = params.get("source") as ImportSourceId | null
	const connecting = stage.at === "start" && connectId && sourceEntry(connectId)?.connect ? connectId : null
	const reset = () => {
		setStage({ at: "start" })
		if (connectId) navigate(href("imports"), { replace: true, preventScrollReset: true })
	}
	const picked = stage.at === "source" ? sourceEntry(stage.id) : null
	const logoRow = (
		<SourceLogoRow onPick={(id) => setStage({ at: "source", id })} connectTo={(id) => `${href("imports")}&source=${id}`} />
	)
	return (
		<div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
			<div className="flex min-w-0 flex-col gap-5">
				<PageDrop onFile={taking.take} />
				{stage.at === "check" || stage.at === "done" ? (
					<FakeCheck
						stage={stage}
						onDone={() => stage.at === "check" && setStage({ ...stage, at: "done" })}
						onOther={reset}
						onReset={reset}
					/>
				) : connecting ? (
					<FakeConnect id={connecting} onOther={reset} />
				) : (
					<>
						<StartDropZone sourceName={picked?.name} reading={taking.reading} unknown={taking.unknown} onFile={taking.take}>
							{!narrow && logoRow}
						</StartDropZone>
						{narrow && logoRow}
						{picked && <SourceSteps source={picked} onOther={reset} />}
					</>
				)}
				<p className="text-sm text-gray-400">
					Coming from TV Time? TV Time closed on July 15, 2026. Import your saved TV Time file on Trakt, then upload your Trakt
					export here.
				</p>
				<p className="text-xs text-gray-500">
					The logos show where a file comes from; no source endorses GoodWatch. IMDb and all related logos are trademarks of
					IMDb.com, Inc. or its affiliates. This product uses the TMDB API but is not endorsed or certified by TMDB.
				</p>
			</div>
			<aside aria-labelledby="b-history" className="flex flex-col gap-3">
				<h2 id="b-history" className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
					Brought in so far
				</h2>
				<ol className="relative flex flex-col gap-5 border-l border-white/10 pl-6">
					{HISTORY.map((item) => {
						const source = sourceEntry(item.source)
						const undone = item.added === "Undone"
						return (
							<li key={item.id} className="relative">
								<span className={`absolute top-1 -left-[1.95rem] size-3 rounded-full ring-4 ring-gray-950 ${undone ? "bg-gray-600" : "bg-amber-400"}`} aria-hidden />
								<p className="text-xs text-gray-500">{item.when}</p>
								<div className="mt-1.5 flex items-start gap-3">
									<SourceMark source={source} />
									<div className="min-w-0">
										<p className="font-semibold text-gray-100">{source.name}</p>
										<p className={`text-sm ${undone ? "text-gray-500" : "text-gray-400"}`}>
											{item.added}
											{item.skipped > 0 && ` · ${item.skipped} left out`}
										</p>
										<p className="mt-1 flex gap-3 text-sm">
											<button type="button" className="cursor-pointer font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
												Receipt
											</button>
											{item.undoable && (
												<button type="button" className="cursor-pointer font-semibold text-gray-300 underline underline-offset-4 hover:text-white">
													Undo
												</button>
											)}
										</p>
									</div>
								</div>
							</li>
						)
					})}
				</ol>
			</aside>
		</div>
	)
}

export function VariantB({ slug }: { slug: PageSlug | null }) {
	const page = slug ? pageOf(slug) : null
	return (
		<div className="mx-auto max-w-7xl px-4 py-4 pb-28 md:px-8 md:py-8">
			<div className="md:grid md:grid-cols-[20rem_minmax(0,1fr)] md:gap-10">
				{/* On a phone the list is the Settings page; on a wide screen it stays beside every page. */}
				<div className={`${page ? "hidden md:block" : ""} md:sticky md:top-20 md:self-start`}>
					<div className="md:hidden">
						<h1 className={`${DISPLAY} mb-5 text-4xl text-white`}>Settings</h1>
					</div>
					<div className="hidden md:block">
						<Rail current={slug} />
					</div>
					<div className="md:hidden">
						<Rail current={slug} phone />
					</div>
				</div>
				<main className={`min-w-0 ${page ? "" : "hidden md:block"}`}>
					{page ? (
						<>
							<PageHeading page={page} />
							{page.slug === "imports" ? <ImportsPage /> : <SharedBody slug={page.slug} />}
						</>
					) : (
						<Overview />
					)}
				</main>
			</div>
		</div>
	)
}
