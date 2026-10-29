// The movie and show page, one page for both:
// - The opener: the backdrop band with the trailer card (every video plays on its stage), the poster, title and meta,
//   then the verdict (scores, the fingerprint's summary, who it's for).
// - On a desktop, a right rail that sticks: the "You" block (Seen and score, Want to See, Not interested, where to
//   watch), find in title, and "On this page" with a line per section that fills as it's read (every section on
//   screen is highlighted). On a phone, a bar at the top that sticks, with the index and find in its own flow.
// - The thin title bar once the opener's title has left the screen.
// - Every section in full (title-sections.tsx), each below the first screen skipping its layout until it's near
//   (below-fold.tsx).
// Keys: "/" finds in the title, J and K step through the sections, W goes to where to watch, S to your score, T to the top.
import { useEffect, useMemo, useRef, useState } from "react"
import type { EpisodeLayout } from "~/domain/tracking/episode-layout"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { GenreRow } from "~/server/genre-row/genre-row.server"
import type { NewPagesHere } from "~/server/new-on-services-page.server"
import type { TitleSides } from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import ShareButton from "~/ui/button/ShareButton"
import AgeRating from "~/ui/details/AgeRating"
import Genres from "~/ui/details/Genres"
import { PhoneBar } from "~/ui/details/PhoneBar"
import { type IndexItem, ProgressIndex } from "~/ui/details/ProgressIndex"
import { TitleBar } from "~/ui/details/TitleBar"
import { YouBlock } from "~/ui/details/YouBlock"
import {
	NearSection,
	belowFoldProps,
	useBelowFold,
} from "~/ui/details/below-fold"
import { FindField, FindResults, useFindItems } from "~/ui/details/find/Find"
import { FindBus, useFindBusValue } from "~/ui/details/find/find-bus"
import { type FindHit, buildFindIndex } from "~/ui/details/find/find-index"
import { flash, locate } from "~/ui/details/find/highlight"
import { GoodForLine } from "~/ui/details/fingerprint/AreaDetails"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { HeroPoster } from "~/ui/details/hero/Trailer"
import {
	TrailerBand,
	hasVideo,
	openerHeaderClass,
} from "~/ui/details/opener/TrailerBand"
import { CAPTION, Kbd, SectionHeader } from "~/ui/details/page-ui"
import { useJump, useReading } from "~/ui/details/reading"
import { sectionHeight } from "~/ui/details/section-heights"
import { useStreamNames } from "~/ui/details/streaming"
import { scoresEntry, useTitleSections } from "~/ui/details/title-sections"
import {
	ageRating,
	fingerprintInput,
	metaItems,
} from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import ExploreBar from "~/ui/explore/ExploreBar"
import { skipIf, summary } from "~/ui/fingerprint/fingerprintText"
import PreferencePair from "~/ui/media-preference/PreferencePair"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { TalkedAboutNowSlot } from "~/ui/talked-about-now/TalkedAboutNowSlot"
import { HEADER_GENRE_COUNT } from "~/utils/title-extras"
import { tmdbImageUrl } from "~/utils/tmdb-image"

export interface TitlePageProps {
	media: MovieResult | ShowResult
	/** The country the offers are for. */
	country: string
	/** The header pair's country (differs while a picked country loads). */
	shownCountry: string
	offersPreview: "loading" | "failed" | null
	textPreview: "loading" | "failed" | null
	episodeGrid: EpisodeGrid | null
	episodeLayout?: EpisodeLayout | null
	questions: TitleQuestion[]
	genreRow?: GenreRow
	newPages?: NewPagesHere
	sides: TitleSides | null
	/** Whether the viewer gets "Talked about now". */
	talkedAboutNow: boolean
	/** The breadcrumb trail, title included. */
	trail: Crumb[]
}

const DESKTOP = "(min-width: 1024px)"
/** The opener's header (poster and title): leaving the screen shows the title bar. */
const OPENER = "title-opener"
const YOU = "you"
/** Something over the page that has the keys: a modal (quick view, score picker, country dialog) or the video stage. */
const OVER_PAGE = '[aria-modal="true"], dialog[open], [data-video-stage]'

export function TitlePage(props: TitlePageProps) {
	const { media, country } = props
	const { details } = media
	const jump = useJump()
	const sections = useTitleSections({ ...props, onCrew: () => jump("crew") })
	const scores = scoresEntry(media)
	const items: IndexItem[] = [scores, ...sections]
	const ids = items.map((i) => i.id)

	const [desktop, setDesktop] = useState(true)
	useEffect(() => {
		const mq = window.matchMedia(DESKTOP)
		const on = () => setDesktop(mq.matches)
		on()
		mq.addEventListener("change", on)
		return () => mq.removeEventListener("change", on)
	}, [])
	// The site header (64), the title bar (48 desktop, 52 phone), and on a phone the section bar (48).
	const { visible, current } = useReading(ids, { offset: desktop ? 128 : 164 })

	// Find in this title: a match scrolls to its section and rings the words.
	const { stream, rentBuy } = useStreamNames(media, country)
	const [query, setQuery] = useState("")
	const [active, setActive] = useState(0)
	const searching = query.trim().length > 0
	const findIndex = useMemo(
		() =>
			searching
				? buildFindIndex({
						media,
						country,
						sections: [scores, ...sections],
						questions: props.questions,
						grid: props.episodeGrid,
						stream,
						rentBuy,
					})
				: [],
		[searching, media, country],
	)
	const example = media.mediaType === "show" ? "“S1E3”" : "“budget”"
	const railFind = useRef<HTMLInputElement>(null)
	const phoneFind = useRef<HTMLInputElement>(null)
	const [phonePanel, setPhonePanel] = useState<"index" | "find" | null>(null)
	const { layOutAll } = useBelowFold()

	const open = (hit: FindHit) => {
		setQuery("")
		setPhonePanel(null)
		layOutAll()
		const id = hit.entry.section
		const needle = hit.entry.needle
		requestAnimationFrame(() => {
			const section = document.getElementById(id)
			const el = needle && section ? locate(section, needle) : null
			if (el) flash(el)
			else jump(id)
		})
	}
	// People come from the server: picking one sends them to Cast or Crew, which search for them and ring their row.
	const bus = useFindBusValue()
	const leave = () => {
		setQuery("")
		setPhonePanel(null)
		;(document.activeElement as HTMLElement | null)?.blur?.()
	}
	const { items: findItems, busy: findBusy } = useFindItems({
		media,
		query,
		index: findIndex,
		sections: items,
		onHit: open,
		onPerson: (kind, row) => {
			leave()
			bus.send({ type: "person", kind, id: row.id, name: row.name })
			requestAnimationFrame(() => jump(kind))
		},
		onCastSearch: (q) => {
			leave()
			bus.send({ type: "cast-search", q })
			requestAnimationFrame(() => jump("cast"))
		},
	})
	const clearFind = (input: HTMLInputElement | null) => {
		setQuery("")
		setActive(0)
		input?.focus()
	}
	const focusFind = () => {
		if (window.matchMedia(DESKTOP).matches) railFind.current?.focus()
		else {
			setPhonePanel("find")
			requestAnimationFrame(() => phoneFind.current?.focus())
		}
	}

	// Keys. "/" finds in the title (the site search keeps Ctrl K): caught before the site's own "/" listener. The
	// others wait until every other handler had the event. None while typing, while a dialog or the video stage is
	// over the page, or when another handler already took the key.
	const keys = useRef<Record<string, () => void>>({})
	keys.current = {
		"/": focusFind,
		j: () => {
			const at = current ? ids.indexOf(current) : -1
			const next = ids[Math.min(ids.length - 1, at + 1)]
			if (next) jump(next)
		},
		k: () => {
			const at = current ? ids.indexOf(current) : -1
			const next = ids[Math.max(0, at - 1)]
			if (next) jump(next)
		},
		w: () => jump("watch"),
		s: () => document.querySelector<HTMLElement>(`#${YOU} button`)?.focus(),
		t: () => window.scrollTo({ top: 0, behavior: "smooth" }),
	}
	useEffect(() => {
		const handlerFor = (e: KeyboardEvent) => {
			const handler = keys.current[e.key]
			if (!handler || e.defaultPrevented || e.isComposing) return null
			if (e.ctrlKey || e.metaKey || e.altKey) return null
			const target = e.target as HTMLElement | null
			if (target?.closest?.("input, textarea, select, [contenteditable]"))
				return null
			if (document.querySelector(OVER_PAGE)) return null
			return handler
		}
		const onSlash = (e: KeyboardEvent) => {
			if (e.key !== "/") return
			const handler = handlerFor(e)
			if (!handler) return
			e.preventDefault()
			e.stopImmediatePropagation()
			handler()
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "/") return
			const handler = handlerFor(e)
			if (!handler) return
			e.preventDefault()
			handler()
		}
		window.addEventListener("keydown", onSlash, { capture: true })
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("keydown", onSlash, { capture: true })
			window.removeEventListener("keydown", onKey)
		}
	}, [])

	// The rail's index keeps the section you're reading in view when the window is short.
	const indexBox = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const box = indexBox.current
		if (!box || searching || !current) return
		const entry = box.querySelector<HTMLElement>(`[aria-current="location"]`)
		if (!entry) return
		const top = entry.offsetTop - box.offsetTop
		if (top < box.scrollTop + 8)
			box.scrollTo({ top: top - 8, behavior: "smooth" })
		else if (top + entry.offsetHeight > box.scrollTop + box.clientHeight - 24)
			box.scrollTo({
				top: top + entry.offsetHeight - box.clientHeight + 24,
				behavior: "smooth",
			})
	}, [current, searching])

	// Every section starts below the first screen, so each skips its layout until it is near the viewport.
	const { skipping } = useBelowFold()

	const t = fingerprintInput(media)
	const skip = t ? skipIf(t) : []
	const age = ageRating(media, country)
	const meta = metaItems(media)
	const title = presentedText(details, "title", details.title)
	const withCard = hasVideo(media)
	// Blurred by 64 px across the whole page, so the smallest backdrop is enough.
	const pageBackdrop = details.backdrop_path
		? tmdbImageUrl(details.backdrop_path, "w300")
		: ""
	const fit = t && (
		<div className="flex flex-col gap-1.5 text-sm">
			<GoodForLine t={t} />
			{skip.length > 0 && (
				<p className="text-gray-300">
					<span className="font-semibold text-rose-200">Skip it if</span>{" "}
					{skip.join(" · ")}
				</p>
			)}
		</div>
	)
	const findPlaceholder = `Find in ${details.title}`

	return (
		<FindBus.Provider value={bus}>
			{/* "overview" is the opener's id from before, so old links land on the top of the page. */}
			<div id="overview" className="relative isolate scroll-mt-16 pb-28">
				{pageBackdrop && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 -z-10"
						style={{
							backgroundImage: `url(${pageBackdrop})`,
							backgroundSize: "cover",
							backgroundPosition: "center",
							filter: "blur(64px) brightness(0.15)",
						}}
					/>
				)}
				{props.trail.length > 0 && (
					<Breadcrumbs
						items={props.trail}
						className="relative [&>ol]:max-w-[88rem] lg:[&>ol]:px-8"
					/>
				)}
				<ExploreBar
					current={{
						tmdb_id: details.tmdb_id,
						media_type: media.mediaType,
						title: details.title,
					}}
				/>

				<TitleBar
					media={media}
					title={title}
					country={country}
					watchId={OPENER}
					youId={YOU}
				/>

				<div className="mx-auto max-w-[88rem] px-4 lg:mt-4 lg:px-8">
					<TrailerBand
						media={media}
						controls={
							<>
								<PreferencePair media={media} />
								<ShareButton />
							</>
						}
					/>

					<div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_19.5rem] xl:gap-x-16">
						{/* Who it is, and the verdict: how good, what it is, who it's for. */}
						<div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:pl-6">
							<header
								id={OPENER}
								className={`relative z-10 flex items-end gap-4 lg:gap-6 ${openerHeaderClass(withCard)}`}
							>
								<HeroPoster
									media={media}
									className={
										withCard ? "w-20 sm:w-28 lg:w-36" : "w-24 sm:w-28 lg:w-36"
									}
								/>
								<div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
									<MediaText
										as="h1"
										value={title}
										aria-busy={props.textPreview === "loading" || undefined}
										data-text-preview={props.textPreview ?? undefined}
										className="text-balance text-2xl font-semibold leading-[1.1] tracking-tight text-white sm:text-3xl lg:text-[2.75rem]"
									/>
									<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-gray-300 lg:text-base">
										{meta.map((item, i) => (
											<span
												key={item}
												className={`whitespace-nowrap ${i === 0 ? "font-semibold text-white" : ""}`}
											>
												{item}
												{(i < meta.length - 1 || age) && (
													<span
														aria-hidden="true"
														className="pl-1.5 text-gray-500"
													>
														&middot;
													</span>
												)}
											</span>
										))}
										{age && <AgeRating ageRating={age} />}
									</p>
									<div className="max-sm:hidden">
										<Genres
											genres={details.genres.slice(0, HEADER_GENRE_COUNT)}
											type={media.mediaType === "movie" ? "movie" : "show"}
											compact={true}
										/>
									</div>
								</div>
							</header>

							<section
								id={scores.id}
								aria-label="Verdict"
								data-feedback-area="scores"
								className="mt-6 scroll-mt-44 lg:mt-8 lg:scroll-mt-32"
							>
								<div
									data-hero-ratings
									className="flex flex-wrap items-center gap-x-5 gap-y-3"
								>
									<ScoreRing media={media} size={52} />
									<div
										data-hero-sites
										className="flex min-w-0 flex-wrap items-center gap-2"
									>
										<RatingChips media={media} fill={false} />
									</div>
								</div>
								{t && (
									<p className="mt-5 max-w-3xl text-pretty text-lg leading-snug text-gray-100 lg:mt-6 lg:text-xl">
										{summary(t)}
									</p>
								)}
								{/* Who it's for. On a phone it follows your actions, so where to watch stays in the first screen. */}
								{fit && (
									<div className="mt-3 max-w-3xl max-lg:hidden">{fit}</div>
								)}
							</section>
						</div>

						{/* The margin: what you do, then find and the index (desktop). On a phone only "You" shows here. */}
						<aside
							aria-label="You and this page"
							className="mt-7 min-w-0 lg:sticky lg:top-32 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:flex lg:max-h-[calc(100dvh-9rem)] lg:flex-col lg:self-start lg:pt-6"
						>
							<section
								id={YOU}
								aria-label="You"
								className="shrink-0 scroll-mt-32"
							>
								<h2 className={`${CAPTION} mb-2.5 max-lg:hidden`}>You</h2>
								<YouBlock
									media={media}
									country={country}
									onWatch={() => jump("watch")}
								/>
							</section>
							{fit && <div className="mt-5 lg:hidden">{fit}</div>}

							<div className="mt-6 hidden min-h-0 flex-1 flex-col border-t border-white/10 pt-5 lg:flex">
								<FindField
									inputRef={railFind}
									query={query}
									onQuery={setQuery}
									placeholder={findPlaceholder}
									items={findItems}
									active={active}
									onActive={setActive}
									listId="find-rail"
								/>
								<h2 className={`${CAPTION} mt-5 px-2.5`}>
									{searching ? "Matches" : "On this page"}
								</h2>
								<div
									ref={indexBox}
									className="relative mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)] [scrollbar-width:none]"
								>
									{searching ? (
										<FindResults
											listId="find-rail"
											query={query}
											items={findItems}
											busy={findBusy}
											active={active}
											onActive={setActive}
											example={example}
											onClear={() => clearFind(railFind.current)}
										/>
									) : (
										<ProgressIndex
											items={items}
											visible={visible}
											onJump={jump}
										/>
									)}
								</div>
								<p className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t border-white/10 px-2.5 pt-2.5 text-[11px] text-gray-500">
									<span>
										<Kbd>/</Kbd> find
									</span>
									<span>
										<Kbd>J</Kbd> <Kbd>K</Kbd> sections
									</span>
									<span>
										<Kbd>W</Kbd> watch
									</span>
									<span>
										<Kbd>T</Kbd> top
									</span>
								</p>
							</div>
						</aside>

						<PhoneBar
							items={items}
							visible={visible}
							panel={phonePanel}
							onJump={jump}
							setPanel={(p) => {
								setPhonePanel(p)
								if (p === "find")
									requestAnimationFrame(() => phoneFind.current?.focus())
								if (p !== "find") setQuery("")
							}}
							find={
								<>
									<FindField
										inputRef={phoneFind}
										query={query}
										onQuery={setQuery}
										placeholder={findPlaceholder}
										items={findItems}
										active={active}
										onActive={setActive}
										listId="find-phone"
									/>
									<div className="mt-2">
										{searching ? (
											<FindResults
												listId="find-phone"
												query={query}
												items={findItems}
												busy={findBusy}
												active={active}
												onActive={setActive}
												example={example}
												onClear={() => clearFind(phoneFind.current)}
											/>
										) : (
											<p className="px-2.5 py-2 text-xs text-gray-500">
												Anyone in the cast or crew, episodes, questions, facts,
												tropes and services.
											</p>
										)}
									</div>
								</>
							}
						/>

						{/* Every section in full. */}
						<div className="mt-10 flex min-w-0 flex-col gap-14 lg:col-start-1 lg:row-start-2 lg:mt-14 lg:gap-16 lg:pl-6">
							{sections.map((s) => (
								<NearSection
									key={s.id}
									id={s.id}
									aria-labelledby={`${s.id}-h`}
									{...belowFoldProps(
										skipping,
										sectionHeight(s.id, media, props),
										"scroll-mt-44 border-t border-white/10 pt-8 lg:scroll-mt-32 lg:pt-10",
									)}
								>
									{s.oldId && (
										// Lands where the section does: its scroll margin plus its top padding.
										<span
											id={s.oldId}
											aria-hidden="true"
											className="block scroll-mt-[208px] lg:scroll-mt-[168px]"
										/>
									)}
									<SectionHeader
										anchor={s.id}
										icon={s.icon}
										title={s.label}
										subtitle={s.subtitle}
									/>
									<div className={`mt-6 min-w-0 lg:mt-8 ${s.bodyClass ?? ""}`}>
										{s.body()}
									</div>
								</NearSection>
							))}
							{/* Appears only when the title has posts, so it isn't a section of the index. */}
							{props.talkedAboutNow && <TalkedAboutNowSlot media={media} />}
						</div>
					</div>
				</div>
			</div>
		</FindBus.Provider>
	)
}
