// PROTOTYPE - throwaway. The pages the variants of /prototype/media-language sit in. The title page is a copy of the
// real one's upper half (~/ui/details: the title bar, the overview card with its where-to-watch box, About) with
// sample data, plus an episode list, one generated answer and a row of other titles, so a language change shows in
// every kind of content. The settings page is a copy of ~/routes/settings.tsx. Every button that would write in the
// real app only says so here. The variants fill the named slots; the page itself is the same under all three.
import {
	ArrowDownTrayIcon,
	AtSymbolIcon,
	BookmarkIcon,
	CheckIcon,
	EyeSlashIcon,
	FlagIcon,
	ShareIcon,
	StarIcon,
	TvIcon,
	UserIcon,
} from "@heroicons/react/24/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { type Country, type OfferKind, TITLES, countryName } from "./fixtures"
import { langLabel, roundOf, useStore } from "./model"
import { Btn, Flag, Logos, Poster, tmdb } from "./parts"

export interface TitleSlots {
	/** The country control in the where-to-watch box's title row. */
	countryControl?: ReactNode
	/** Round two: the country and language controls, in the title bar beside Share. Its own overlays lie over the
	 * page, so the bar keeps its height. */
	headerControl?: ReactNode
	/** Round two: shown in place of the line of facts under the title (the title stays), in the same cell. */
	factsReplacement?: ReactNode
	/** Round two: a fixed height for the line of facts, so the bar is as high with or without the replacement. */
	factsRowClass?: string
	/** Round two: leaves out Share, to give an edit mode the room. */
	hideShare?: boolean
	/** A line inside the where-to-watch box, over the services. */
	watchNotice?: ReactNode
	/** A bar under the title bar, across the page. */
	pageNotice?: ReactNode
	/** Beside the About heading. */
	aboutControl?: ReactNode
	/** The control at the end of the page's region line. */
	regionControl?: ReactNode
	/** A country row of "Where it is" was pressed. */
	onOtherCountry: (country: Country) => void
}

const OFFER_LABEL: Record<OfferKind, string> = {
	stream: "Stream",
	rent: "Rent",
}

function WhereToWatch({ slots }: { slots: TitleSlots }) {
	const { title, effective } = useStore()
	const [kind, setKind] = useState<OfferKind>("stream")
	const here = title.offers[effective.country]
	const services = here[kind]
	const elsewhere = (Object.keys(title.offers) as Country[]).filter(
		(c) => c !== effective.country && title.offers[c][kind].length > 0,
	)
	const verb = kind === "stream" ? "streaming" : "to rent"
	return (
		<div
			data-where-to-watch
			className="@container relative min-w-0 rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/[0.07]"
		>
			<div className="flex min-w-0 items-center justify-end gap-1.5">
				<h2 className="mr-auto min-w-0 truncate text-sm font-semibold text-white">
					<span className="@[30rem]:hidden">Watch</span>
					<span className="hidden @[30rem]:inline">Where to watch</span>
				</h2>
				<div
					role="tablist"
					aria-label="Offer type"
					className="flex shrink-0 rounded-full bg-white/8 p-0.5 text-[11px] sm:text-xs"
				>
					{(["stream", "rent"] as const).map((k) => (
						<button
							key={k}
							type="button"
							role="tab"
							aria-selected={kind === k}
							onClick={() => setKind(k)}
							className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 ${kind === k ? "bg-white font-semibold text-black" : here[k].length ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-300"}`}
						>
							{OFFER_LABEL[k]}
							{here[k].length > 0 && (
								<span
									className={`min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 tabular-nums ${kind === k ? "bg-black/10 text-black" : "bg-white/10 text-gray-200"}`}
								>
									{here[k].length}
								</span>
							)}
						</button>
					))}
				</div>
				{slots.countryControl ?? (
					// Round two: the country is set in the title bar; here it is only named.
					<span
						data-country-label
						className="inline-flex h-7 shrink-0 items-center gap-1.5 px-1.5 text-xs text-gray-400"
					>
						<Flag code={effective.country} className="h-2.5" />
						{effective.country}
					</span>
				)}
			</div>
			{slots.watchNotice}
			{services.length > 0 ? (
				<div className="mt-2.5 grid grid-cols-2 gap-2 pt-0.5">
					{services.map((s, i) => (
						<span
							key={s}
							className={`flex h-12 min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.06] pr-2.5 ring-1 ring-white/10 ${i === services.length - 1 && services.length % 2 === 1 ? "col-span-2" : ""}`}
						>
							<Logos services={[s]} size="h-12 w-12 !rounded-xl !ring-0" />
							<span className="min-w-0 truncate text-sm font-medium text-white">
								{s}
							</span>
						</span>
					))}
				</div>
			) : (
				<div className="mt-2">
					<p className="text-sm text-gray-400">
						Not {verb} in {countryName(effective.country)}.
						{elsewhere.length > 0 ? " Where it is:" : ""}
					</p>
					{elsewhere.length > 0 && (
						<ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl bg-white/[0.05] ring-1 ring-white/10">
							{elsewhere.slice(0, 3).map((c) => (
								<li key={c}>
									<button
										type="button"
										onClick={() => slots.onOtherCountry(c)}
										className="flex h-11 w-full cursor-pointer items-center gap-2.5 px-3 text-left hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
									>
										<Flag code={c} className="h-3.5" />
										<span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
											{countryName(c)}
										</span>
										<Logos services={title.offers[c][kind]} size="h-5 w-5" />
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	)
}

function ScoreRing({ score }: { score: number }) {
	const r = 24
	const c = 2 * Math.PI * r
	return (
		<div className="flex items-center gap-2.5">
			<span className="relative h-14 w-14 shrink-0">
				<svg width={56} height={56} className="-rotate-90" aria-hidden="true">
					<circle
						cx={28}
						cy={28}
						r={r}
						fill="rgba(0,0,0,.55)"
						stroke="rgba(255,255,255,.14)"
						strokeWidth={5}
					/>
					<circle
						cx={28}
						cy={28}
						r={r}
						fill="none"
						stroke="#4ade80"
						strokeWidth={5}
						strokeLinecap="round"
						strokeDasharray={`${(c * score) / 100} ${c}`}
					/>
				</svg>
				<span className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums text-white">
					{score}
				</span>
			</span>
			<span className="flex flex-col leading-tight">
				<span className="text-base font-semibold text-green-400">
					Must watch
				</span>
				<span className="text-xs text-gray-300">GoodWatch score</span>
			</span>
		</div>
	)
}

/** The title page with the variant's controls in its slots. */
export function TitlePage({ slots }: { slots: TitleSlots }) {
	const s = useStore()
	const { title, shown, effective } = s
	const off = (what: string) => () => s.say(`${what} is off in this prototype`)
	const others = TITLES.filter((t) => t.id !== title.id)
	return (
		<div data-title-page>
			<div className="sticky top-16 z-30 border-b border-white/15 bg-black/80 backdrop-blur-sm">
				<div
					data-title-bar
					className="relative m-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3"
				>
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<h1
							lang={shown.title.lang}
							data-page-title
							className="overflow-hidden text-ellipsis whitespace-nowrap text-xl font-medium text-white sm:text-2xl lg:text-3xl"
						>
							{shown.title.value}
						</h1>
						{/* The facts and a replacement share one cell. The facts never wrap: a narrow bar clips them
							    instead of growing a line. */}
						<div
							className={`grid min-w-0 items-center ${slots.factsRowClass ?? ""}`}
						>
							<div
								data-facts
								className={`col-start-1 row-start-1 flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap text-xs text-gray-400 md:text-sm lg:text-base ${slots.factsReplacement ? "invisible" : ""}`}
							>
								<span className="font-semibold">{title.year}</span>
								<span>&middot;</span>
								<span>{title.mediaType === "movie" ? "Movie" : "Show"}</span>
								<span>&middot;</span>
								<span>{title.facts}</span>
								<span className="hidden sm:inline">&middot;</span>
								<span className="hidden sm:inline">
									{title.genres.join(", ")}
								</span>
							</div>
							{slots.factsReplacement && (
								<div className="col-start-1 row-start-1 flex min-w-0 items-center">
									{slots.factsReplacement}
								</div>
							)}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						{slots.headerControl}
						{!slots.hideShare && (
							<button
								type="button"
								onClick={off("Sharing")}
								aria-label="Share"
								className="shrink-0 cursor-pointer rounded-full p-2 text-gray-300 hover:bg-white/10"
							>
								<ShareIcon className="h-5 w-5" />
							</button>
						)}
					</div>
				</div>
			</div>
			{slots.pageNotice}

			<div className="relative mx-auto mb-10 mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
				<section className="relative isolate z-20 min-w-0 rounded-2xl border border-white/10 bg-stone-950">
					<div className="relative">
						<div
							className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-t-2xl"
							aria-hidden="true"
						>
							<img
								src={tmdb(title.backdrop, "w1280")}
								alt=""
								className="h-full w-full object-cover object-[center_22%]"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
							<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-transparent" />
						</div>
						<div className="px-4 pb-4 pt-14 md:px-6 md:pb-5 md:pt-10">
							<div className="flex items-end gap-3 md:gap-6">
								<Poster
									field={shown.poster}
									title={shown.title.value}
									className="w-[4.5rem] !rounded-xl shadow-[0_8px_30px_rgba(0,0,0,.7)] md:w-32"
								/>
								<div className="min-w-0 flex-1 md:max-w-md">
									<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
										<ScoreRing score={title.score} />
										<button
											type="button"
											onClick={off("Rating")}
											className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 px-4 text-sm font-bold text-yellow-300 hover:bg-yellow-400/10 max-md:w-full md:min-w-[10.75rem]"
										>
											<StarIcon className="h-4 w-4" />
											Rate this
										</button>
									</div>
									<div className="mt-3 flex flex-wrap items-center gap-1.5">
										{title.sites.map((site) => (
											<span
												key={site.name}
												className="inline-flex h-7 items-center gap-1.5 rounded-md bg-white/10 px-2 text-[13px] font-semibold tabular-nums text-gray-200"
											>
												<span className="text-gray-400">{site.name}</span>
												{site.value}
											</span>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>
					{/* items-start: when the where-to-watch box grows (another country), the actions beside it keep their
					    place and size instead of stretching and re-centring. */}
					<div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-2">
						<div
							data-actions
							className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10 [&>*]:flex-1"
						>
							<Btn onClick={off("Want to see")}>
								<BookmarkIcon className="h-4 w-4" />
								Want to see
							</Btn>
							<Btn onClick={off("Seen it")}>
								<CheckIcon className="h-4 w-4" />
								Seen it
							</Btn>
							<Btn onClick={off("Not interested")} className="max-sm:hidden">
								<EyeSlashIcon className="h-4 w-4" />
								Not interested
							</Btn>
						</div>
						<WhereToWatch slots={slots} />
					</div>
				</section>
			</div>

			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<section
					data-about
					className="rounded-xl border border-white/3 bg-white/3 p-4 sm:p-6"
				>
					<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<h2 className="text-2xl text-white">About</h2>
						{slots.aboutControl}
					</div>
					<blockquote className="relative mt-4 rounded-lg border border-l-8 border-white/10 bg-white/5 p-4 sm:p-5">
						<p
							lang={shown.tagline.lang}
							className="text-base italic leading-relaxed text-white/90 sm:text-lg"
						>
							{shown.tagline.value}
						</p>
					</blockquote>
					<p
						lang={shown.overview.lang}
						data-description
						className="my-6 text-gray-100 sm:text-lg lg:text-xl"
					>
						{shown.overview.value}
					</p>
					{shown.missing.length > 0 && (
						<p
							data-missing
							className="rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-300 ring-1 ring-white/10"
						>
							Not everything about this title is in {langLabel(effective.lang)}{" "}
							yet. Shown in another language: the {shown.missing.join(", ")}.
						</p>
					)}
				</section>

				{shown.episodes.length > 0 && (
					<section className="mt-8 rounded-xl border border-white/3 bg-white/3 p-4 sm:p-6">
						<h2 className="text-2xl text-white">Season 1</h2>
						<ol className="mt-4 divide-y divide-white/10">
							{shown.episodes.map((e) => (
								<li key={e.number} className="flex gap-3 py-3">
									<span className="w-6 shrink-0 text-right text-sm tabular-nums text-gray-500">
										{e.number}
									</span>
									<span className="min-w-0">
										<span
											lang={e.name.lang}
											className="block font-semibold text-white"
										>
											{e.name.value}
										</span>
										<span
											lang={e.overview.lang}
											className="mt-1 block text-sm text-gray-300"
										>
											{e.overview.value}
										</span>
									</span>
								</li>
							))}
						</ol>
					</section>
				)}

				<section className="mt-8 rounded-xl border border-white/3 bg-white/3 p-4 sm:p-6">
					<h2 className="text-2xl text-white">Questions</h2>
					<div lang={shown.generated.lang} className="mt-4">
						<h3 className="font-semibold text-white">
							{GENERATED_QUESTION[title.id]?.[shown.generated.lang] ??
								title.question}
						</h3>
						<p className="mt-1 text-gray-300">{shown.generated.value}</p>
					</div>
				</section>

				{/* Round two keeps to the current title: no other titles on the page. */}
				{roundOf(s.variant) === 1 && (
					<section className="mt-8">
						<h2 className="text-2xl text-white">More like this</h2>
						<div className="mt-4 flex gap-4">
							{others.map((t) => {
								const o = s.resolve(t, effective.lang)
								return (
									<button
										key={t.id}
										type="button"
										onClick={() => {
											s.openTitle(t.id)
											// A real navigation to another title starts at its top.
											window.scrollTo({ top: 0, behavior: "instant" })
										}}
										className="group w-28 cursor-pointer text-left sm:w-36"
									>
										<Poster
											field={o.poster}
											title={o.title.value}
											className="w-full group-hover:ring-white/40"
										/>
										<span
											lang={o.title.lang}
											className="mt-2 block truncate text-sm font-medium text-gray-200 group-hover:text-white"
										>
											{o.title.value}
										</span>
									</button>
								)
							})}
						</div>
					</section>
				)}

				{slots.regionControl !== undefined && (
					<div
						data-region-line
						className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 py-4 text-sm text-gray-400"
					>
						<span className="inline-flex items-center gap-1.5">
							<Flag code={effective.country} />
							Watching from{" "}
							<span className="font-semibold text-gray-200">
								{countryName(effective.country)}
							</span>
							{effective.countrySource === "guess" && " (our guess)"}
							{effective.countrySource === "look" && " (not saved)"}
						</span>
						<span>
							Titles in{" "}
							<span className="font-semibold text-gray-200">
								{langLabel(effective.lang)}
							</span>
							{effective.langSource === "browser" && " (browser default)"}
							{effective.langSource === "look" && " (this visit only)"}
						</span>
						<span className="ml-auto">{slots.regionControl}</span>
					</div>
				)}
			</div>
		</div>
	)
}

// The question over a generated answer is part of the generated block, so it changes with the answer.
const GENERATED_QUESTION: Record<string, Partial<Record<string, string>>> = {
	"spirited-away": {
		de: "Lohnt sich der Film?",
		fr: "Vaut-il le détour ?",
		es: "¿Merece la pena?",
		ja: "観る価値はありますか？",
	},
	"money-heist": {
		de: "Wie lange dauert es, bis die Serie in Fahrt kommt?",
		es: "¿Cuánto tarda en arrancar?",
	},
	portrait: { fr: "Le film est-il lent ?" },
}

const SETTINGS_NAV = [
	{ name: "Country and language", icon: FlagIcon, current: true },
	{ name: "Streaming", icon: TvIcon },
	{ name: "Profile", icon: AtSymbolIcon },
	{ name: "Imports", icon: ArrowDownTrayIcon },
	{ name: "Hidden titles", icon: EyeSlashIcon },
	{ name: "Account", icon: UserIcon },
]

/** The member's settings page, with the variant's form as the open section. */
export function SettingsPage({ children }: { children: ReactNode }) {
	const s = useStore()
	return (
		<div
			data-settings-page
			className="mx-auto max-w-7xl px-4 py-2 sm:px-8 md:py-4 lg:py-8"
		>
			<div className="flex flex-col gap-4 text-gray-300">
				<h1 className="my-3 text-center text-2xl font-bold tracking-tight text-gray-100 sm:my-6 sm:text-3xl md:text-4xl lg:text-5xl">
					Your Settings
				</h1>
				<hr className="mb-4 border-gray-700" />
				<div className="flex flex-wrap gap-4 lg:gap-8">
					<nav aria-label="Sidebar" className="max-md:w-full">
						<ul className="flex gap-1 max-md:overflow-x-auto md:-mx-2 md:w-52 md:flex-col">
							{SETTINGS_NAV.map((item) => (
								<li key={item.name} className="shrink-0">
									<button
										type="button"
										onClick={
											item.current
												? undefined
												: () => s.say(`${item.name} is off in this prototype`)
										}
										aria-current={item.current ? "page" : undefined}
										className={`flex w-full cursor-pointer gap-x-3 rounded-md p-2 text-sm/6 font-semibold ${item.current ? "bg-indigo-800 text-gray-50" : "text-gray-400 hover:bg-indigo-900 hover:text-gray-100"}`}
									>
										<item.icon aria-hidden="true" className="h-6 w-6" />
										{item.name}
									</button>
								</li>
							))}
						</ul>
					</nav>
					<div className="min-w-0 flex-1 basis-80">
						<h2 className="text-base font-bold tracking-tight text-gray-100 sm:text-lg md:text-xl lg:text-2xl">
							Country and language
						</h2>
						<div className="mt-4">{children}</div>
					</div>
				</div>
			</div>
		</div>
	)
}

/** The page's own answer to a save or a stubbed action: one line, with Undo when there is something to take back. */
export function ToastView() {
	const { toast, dismissToast } = useStore()
	const dismiss = useRef(dismissToast)
	dismiss.current = dismissToast
	const id = toast?.id
	const long = Boolean(toast?.undo)
	useEffect(() => {
		if (id === undefined) return
		const timer = setTimeout(() => dismiss.current(), long ? 9000 : 4500)
		return () => clearTimeout(timer)
	}, [id, long])
	return (
		<div
			aria-live="polite"
			className="pointer-events-none fixed inset-x-0 bottom-36 z-[55] flex justify-center px-4 md:bottom-24"
		>
			{toast && (
				<div
					key={toast.id}
					data-toast
					className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-2xl ring-1 ${toast.tone === "error" ? "bg-red-950 text-red-100 ring-red-400/40" : "bg-stone-800 text-white ring-white/15"}`}
				>
					<span>{toast.text}</span>
					{toast.undo && (
						<button
							type="button"
							onClick={toast.undo}
							className="shrink-0 cursor-pointer rounded-md px-2 py-1 font-bold text-amber-300 hover:bg-white/10"
						>
							Undo
						</button>
					)}
				</div>
			)}
		</div>
	)
}
