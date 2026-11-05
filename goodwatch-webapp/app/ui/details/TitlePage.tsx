// The movie and show page, one page for both:
// - The opener: the backdrop band with the trailer card (every video plays on its stage), the poster, title, meta
//   (a show's seasons and episodes link to its Episodes, its status beside the age box) and scores, then the Summary
//   section (the synopsis, the essence tags, who it's for and who should skip it). On a phone the "You" block comes
//   between the scores and the Summary.
// - On a desktop, a right rail that sticks: the "You" block (Seen and score, Want to See, Not interested, where to
//   watch), find in this title (the page and its sub-pages), and "On this page" with a line per section that fills as
//   it's read (every section on screen is highlighted, and a section with a sub-page shows the way in). On a phone, a
//   bar at the top that sticks, with the index and find in its own flow.
// - The thin title bar once the opener's title has left the screen.
// - Every section (title-sections.tsx), each below the first screen skipping its layout until it's near
//   (below-fold.tsx). Fingerprint, At a glance and Tropes each open into a sub-page at its own address
//   (sub-page/), and Back from one lands where the page was left.
// Keys: "/" finds in the title, J and K step through the sections, W goes to where to watch, S to your score, T to the top.
import { DocumentTextIcon, PlayIcon } from "@heroicons/react/24/outline"
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
import type { IndexItem } from "~/ui/details/ProgressIndex"
import { ShowStatus } from "~/ui/details/ShowStatus"
import { TitleBar } from "~/ui/details/TitleBar"
import { TitleSummary } from "~/ui/details/TitleSummary"
import { YouBlock } from "~/ui/details/YouBlock"
import {
	NearSection,
	belowFoldProps,
	useBelowFold,
} from "~/ui/details/below-fold"
import { FindField, FindResults, useFindItems } from "~/ui/details/find/Find"
import {
	FindBus,
	type FindRequest,
	useFindBusValue,
} from "~/ui/details/find/find-bus"
import {
	type FindEntry,
	type FindSection,
	buildFindIndex,
} from "~/ui/details/find/find-index"
import { flash, locate } from "~/ui/details/find/highlight"
import { type PageGo, goSub, takePageGo } from "~/ui/details/find/landing"
import { markHl, useHlParam } from "~/ui/details/find/marks"
import { shelfEntries } from "~/ui/details/find/sub-page-index"
import {
	keepPageIndex,
	titleKey,
	useCrossFind,
} from "~/ui/details/find/useSubPageFind"
import { goodFor } from "~/ui/details/fingerprint/area-details"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { HeroPoster } from "~/ui/details/hero/Trailer"
import { PhoneShelfNav } from "~/ui/details/more-like-this/PhoneShelfNav"
import type { ShelfTitle } from "~/ui/details/more-like-this/shelf-data"
import {
	TrailerBand,
	hasVideo,
	openerHeaderClass,
} from "~/ui/details/opener/TrailerBand"
import { CAPTION, SectionHeader } from "~/ui/details/page-ui"
import { TitleRail } from "~/ui/details/rail/TitleRail"
import { usePublishPageMeta } from "~/ui/details/rail/rail-model"
import { scrollToTop, useJump, useReading } from "~/ui/details/reading"
import { sectionHeight } from "~/ui/details/section-heights"
import { useStreamNames } from "~/ui/details/streaming"
import { SubPageLinks } from "~/ui/details/sub-page/SubPageLinks"
import { AT_A_GLANCE, subPagePath } from "~/ui/details/sub-page/paths"
import { stopRestore, useKeptState } from "~/ui/details/sub-page/way-in"
import {
	FIND_ONLY_SECTIONS,
	scoresEntry,
	summaryEntry,
	useTitleSections,
} from "~/ui/details/title-sections"
import {
	ageRating,
	fingerprintInput,
	fitMeta,
	metaItems,
} from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import ExploreBar from "~/ui/explore/ExploreBar"
import { skipIf } from "~/ui/fingerprint/fingerprintText"
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
	/** More like this's Similar shelf, when the loader had it in time. */
	similar?: ShelfTitle[]
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
/** What the band plays, for the index's Trailer entry: "2 trailers, 3 clips, 1 featurette". */
function videoPeek(media: MovieResult | ShowResult) {
	const v = media.videos
	const parts = (
		[
			[v?.trailers?.length ?? 0, "trailer"],
			[v?.clips?.length ?? 0, "clip"],
			[v?.featurettes?.length ?? 0, "featurette"],
		] as const
	)
		.filter(([n]) => n > 0)
		.map(([n, w]) => `${n} ${w}${n === 1 ? "" : "s"}`)
	return parts.length ? parts.join(", ") : "Back to the top"
}

/** The meta line's separator. */
const Dot = () => (
	<span aria-hidden="true" className="pl-1.5 text-gray-500">
		&middot;
	</span>
)

/** Something over the page that has the keys: a modal (quick view, score picker, country dialog) or the video stage. */
const OVER_PAGE = '[aria-modal="true"], dialog[open], [data-video-stage]'

/**
 * Where find's and the rail's section ids are on this page: the people and the facts are rows of At a glance (opened
 * on the way); old links to the questions land on At a glance, to the related titles on More like this.
 */
const GLANCE_ROW: Record<string, string> = {
	cast: "glance-cast",
	crew: "glance-crew",
	facts: "glance-facts",
}
const MOVED: Record<string, string> = {
	faq: "at-a-glance",
	related: "more-like-this",
}

export function TitlePage(props: TitlePageProps) {
	const { media, country } = props
	const { details } = media
	const jumpTo = useJump()
	// At a glance's open rows, kept per history entry: Back from a sub-page finds them open.
	const [openRows, setOpenRows] = useKeptState<string[]>("at-a-glance", [])
	const toggleRow = (id: string) =>
		setOpenRows((o) =>
			o.includes(id) ? o.filter((x) => x !== id) : [...o, id],
		)
	/** Opens what holds section `id` and says where to scroll. */
	const reveal = (id: string): string => {
		const row = GLANCE_ROW[id]
		if (row) {
			setOpenRows((o) => (o.includes(row) ? o : [...o, row]))
			return row
		}
		return MOVED[id] ?? id
	}
	// The index starts with the trailer, which takes you back to the top of the page. The scores sit in the opener
	// too, so find's score lines go there as well.
	const jump = (id: string) => {
		if (id !== "trailer" && id !== "scores") {
			const target = reveal(id)
			// An At a glance row opens first, so the jump waits for it to be there.
			requestAnimationFrame(() => requestAnimationFrame(() => jumpTo(target)))
			return
		}
		scrollToTop()
		history.replaceState(
			history.state,
			"",
			window.location.pathname + window.location.search,
		)
	}
	const sections = useTitleSections({
		...props,
		glance: { open: openRows, onToggle: toggleRow },
	})
	const scores = scoresEntry(media)
	const summary = summaryEntry(media)
	const trailer: IndexItem | null = hasVideo(media)
		? {
				id: "trailer",
				label: "Trailer",
				icon: PlayIcon,
				peek: videoPeek(media),
			}
		: null
	const items: IndexItem[] = [
		...(trailer ? [trailer] : []),
		summary,
		...sections,
	]
	const ids = items.map((i) => i.id)
	// The bar's meta line, for the header of More like this's expanded view.
	usePublishPageMeta(fitMeta(media, country))

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

	// Find in this title: a match scrolls to its section and rings the words. The people, the facts and the related
	// titles are find's own sections too (where they are is reveal's).
	const { stream, rentBuy } = useStreamNames(media, country)
	const [query, setQuery] = useState("")
	const [active, setActive] = useState(0)
	const searching = query.trim().length > 0
	const findSections: FindSection[] = [
		scores,
		summary,
		...sections,
		...FIND_ONLY_SECTIONS,
	]
	const buildIndex = (): FindEntry[] =>
		buildFindIndex({
			media,
			country,
			sections: findSections,
			// The questions' answers aren't on the page.
			questions: [],
			grid: props.episodeGrid,
			stream,
			rentBuy,
		})
	const findIndex = useMemo(
		() => (searching ? [...buildIndex(), ...shelfEntries()] : []),
		[searching, media, country],
	)
	// Find also searches the sub-pages, from the first focus on.
	const [findArmed, setFindArmed] = useState(false)
	const armFind = () => setFindArmed(true)
	// The page's own index, kept for its sub-pages' find, once the page has settled.
	useEffect(() => {
		const t = window.setTimeout(
			() =>
				keepPageIndex(titleKey(media), {
					entries: buildIndex(),
					sections: findSections.map((x) => ({ id: x.id, label: x.label })),
				}),
			1200,
		)
		return () => window.clearTimeout(t)
	}, [media.details.tmdb_id, stream.length, rentBuy.length])
	const example = media.mediaType === "show" ? "“S1E3”" : "“budget”"
	const railFind = useRef<HTMLInputElement>(null)
	const phoneFind = useRef<HTMLInputElement>(null)
	const [phonePanel, setPhonePanel] = useState<"index" | "find" | null>(null)
	const { layOutAll } = useBelowFold()

	const open = (entry: Pick<FindEntry, "section" | "needle" | "selector">) => {
		setQuery("")
		setPhonePanel(null)
		layOutAll()
		const id = reveal(entry.section)
		const { needle, selector } = entry
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				const section = document.getElementById(id)
				const picked =
					selector && section
						? section.querySelector<HTMLElement>(selector)
						: null
				// A poster on a shelf that scrolls sideways: into the row's view first.
				picked?.scrollIntoView({
					block: "nearest",
					inline: "center",
					behavior: "instant",
				})
				const el =
					picked ?? (needle && section ? locate(section, needle) : null)
				if (el) flash(el)
				else jumpTo(id)
			}),
		)
	}
	// People come from the server: picking someone from the cast sends them to Starring's cast list, which searches for
	// them and rings their row. It sits in At a glance's row and only listens once the row is open, so the request goes
	// again once it is. Made by's credits list the whole crew: the name is rung there once the list is in.
	const bus = useFindBusValue()
	const askPeople = (r: FindRequest, kind: "cast" | "crew") => {
		requestAnimationFrame(() => jump(kind))
		if (r.type === "person" && kind === "crew") {
			let tries = 0
			const ring = () => {
				const credits = document.getElementById("glance-crew")
				const el = credits ? locate(credits, r.name) : null
				if (el) flash(el)
				else if (++tries < 12) window.setTimeout(ring, 250)
			}
			window.setTimeout(ring, 450)
			return
		}
		bus.send(r)
		window.setTimeout(() => bus.send(r), 450)
	}
	useHlParam()
	const leave = () => {
		// The picked words are marked where it lands (?hl=).
		markHl(query)
		setQuery("")
		setPhonePanel(null)
		;(document.activeElement as HTMLElement | null)?.blur?.()
	}
	// Find's own sections are At a glance's rows: their matches are grouped under it.
	const findGroups = [
		...items,
		...FIND_ONLY_SECTIONS.map(({ id }) => ({
			id,
			label: AT_A_GLANCE,
			icon: DocumentTextIcon,
		})),
	]
	const { items: findItems, busy: findBusy } = useFindItems({
		media,
		query,
		index: findIndex,
		sections: findGroups,
		onHit: (hit) => {
			markHl(query)
			const e = hit.entry
			// A section found by its gist (no words of its own to ring): ring where the words are in it.
			open(
				e.needle || e.selector
					? e
					: { section: e.section, needle: query.trim() },
			)
		},
		onPerson: (kind, row) => {
			leave()
			askPeople({ type: "person", kind, id: row.id, name: row.name }, kind)
		},
		onCastSearch: (q) => {
			leave()
			askPeople({ type: "cast-search", q }, "cast")
		},
	})
	// The sub-pages' matches, after the page's own; picking one goes in through its link.
	const cross = useCrossFind({
		media,
		country,
		questions: props.questions,
		query,
		armed: findArmed || searching,
		here: "page",
		onPick: (e) => {
			leave()
			goSub(
				subPagePath(e.sub, media),
				e.go,
				document.querySelector('aside[aria-label="You and this page"]'),
			)
		},
	})
	const allFindItems = [...findItems, ...cross.items]
	const allFindBusy = findBusy || cross.busy
	// A match on this page picked on a sub-page: land on it once the page is back (and has put its place back).
	const landPage = (go: PageGo) => {
		stopRestore()
		if (go.person) askPeople({ type: "person", ...go.person }, go.person.kind)
		else if (go.castSearch)
			askPeople({ type: "cast-search", q: go.castSearch }, "cast")
		else open(go)
	}
	const landRef = useRef(landPage)
	landRef.current = landPage
	useEffect(() => {
		// Taken once and never cancelled (an effect that runs twice must not lose it).
		const go = takePageGo(window.location.pathname)
		if (go) window.setTimeout(() => landRef.current(go), 320)
	}, [])
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
		// Measured on screen: the list's own children put the entry's offsetParent elsewhere.
		const top =
			entry.getBoundingClientRect().top -
			box.getBoundingClientRect().top +
			box.scrollTop
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
	// A show's seasons and episodes are one link to its Episodes section.
	const isEpisodes = (m: string) =>
		media.mediaType === "show" && /^\d[\d,]* (season|episode)s?$/.test(m)
	const metaHead = meta.filter((m) => !isEpisodes(m))
	const metaEpisodes = meta.filter(isEpisodes)
	const status = <ShowStatus media={media} />
	const hasStatus = media.mediaType === "show" && Boolean(media.details.status)
	const title = presentedText(details, "title", details.title)
	const withCard = hasVideo(media)
	// Blurred by 64 px across the whole page, so the smallest backdrop is enough.
	const pageBackdrop = details.backdrop_path
		? tmdbImageUrl(details.backdrop_path, "w300")
		: ""
	// The score ring and the sites' chips, beside the poster from lg up and full width under the header on a phone.
	const ratings = (className: string) => (
		<div
			data-hero-ratings
			className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${className}`}
		>
			<ScoreRing media={media} size={44} />
			<div
				data-hero-sites
				className="flex min-w-0 flex-wrap items-center gap-2"
			>
				<RatingChips media={media} fill={false} />
			</div>
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
				>
					{/* While More like this is expanded, the row holds its shelves. */}
					<PhoneShelfNav>
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
										onFocus={armFind}
										query={query}
										onQuery={setQuery}
										placeholder={findPlaceholder}
										items={allFindItems}
										active={active}
										onActive={setActive}
										listId="find-phone"
									/>
									<div className="mt-2">
										{searching ? (
											<FindResults
												listId="find-phone"
												query={query}
												items={allFindItems}
												busy={allFindBusy}
												active={active}
												onActive={setActive}
												example={example}
												onClear={() => clearFind(phoneFind.current)}
											/>
										) : (
											<p className="px-2.5 py-2 text-xs text-gray-500">
												Anyone in the cast or crew, episodes, facts, the
												fingerprint, tropes and services.
											</p>
										)}
									</div>
								</>
							}
						/>
					</PhoneShelfNav>
				</TitleBar>

				<div className="mx-auto max-w-[88rem] px-4 lg:mt-4 lg:px-8">
					{/* The index's Trailer entry tracks the band. */}
					<div id="trailer">
						<TrailerBand
							media={media}
							controls={
								<>
									<PreferencePair media={media} />
									<ShareButton />
								</>
							}
						/>
					</div>

					<div className="max-lg:flex max-lg:flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_19.5rem] xl:gap-x-16">
						{/* Who it is and how good, then the Summary: what it is, who it's for. On a phone this column dissolves
						    (contents), so "You" sits between the scores and the Summary. */}
						<div className="min-w-0 max-lg:contents lg:col-start-1 lg:row-start-1 lg:pl-6">
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
										{metaHead.map((item, i) => (
											<span
												key={item}
												className={`whitespace-nowrap ${i === 0 ? "font-semibold text-white" : ""}`}
											>
												{item}
												{(i < metaHead.length - 1 ||
													metaEpisodes.length > 0 ||
													age ||
													hasStatus) && <Dot />}
											</span>
										))}
										{metaEpisodes.length > 0 && (
											<span className="whitespace-nowrap">
												{ids.includes("episodes") ? (
													// biome-ignore lint/a11y/useValidAnchor: a real link to the section, also before the page's scripts run
													<a
														href="#episodes"
														onClick={(e) => {
															if (
																e.button !== 0 ||
																e.metaKey ||
																e.ctrlKey ||
																e.shiftKey ||
																e.altKey
															)
																return
															e.preventDefault()
															jump("episodes")
														}}
														className="rounded-sm underline decoration-white/25 decoration-1 underline-offset-[5px] transition-colors hover:text-amber-200 hover:decoration-amber-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
													>
														{metaEpisodes.join(" · ")}
													</a>
												) : (
													metaEpisodes.join(" · ")
												)}
												{(age || hasStatus) && <Dot />}
											</span>
										)}
										{age && <AgeRating ageRating={age} />}
										{status}
									</p>
									<div className="max-sm:hidden">
										<Genres
											genres={details.genres.slice(0, HEADER_GENRE_COUNT)}
											type={media.mediaType === "movie" ? "movie" : "show"}
											compact={true}
										/>
									</div>
									{ratings("mt-2 max-lg:hidden")}
								</div>
							</header>
							{/* On a phone the title column is narrow: the scores go full width under the header. */}
							{ratings("mt-5 lg:hidden")}

							<section
								id="summary"
								aria-labelledby="summary-h"
								data-feedback-area="scores"
								className="mt-8 scroll-mt-44 border-t max-lg:order-2 border-white/10 pt-8 lg:mt-10 lg:scroll-mt-32 lg:pt-10"
							>
								{/* Old links: the verdict was #scores, the story further down #story and before that #about. */}
								{["scores", "story", "about"].map((id) => (
									<span
										key={id}
										id={id}
										aria-hidden="true"
										className="block scroll-mt-[208px] lg:scroll-mt-[168px]"
									/>
								))}
								<SectionHeader
									anchor="summary"
									icon={DocumentTextIcon}
									title="Summary"
								/>
								<div className="mt-6 lg:mt-8">
									<TitleSummary
										media={media}
										goodFor={t ? goodFor(t) : []}
										skip={skip}
									/>
								</div>
							</section>
						</div>

						{/* The margin: what you do, then find and the index (desktop). On a phone only "You" shows here. */}
						<aside
							aria-label="You and this page"
							className="mt-7 min-w-0 max-lg:order-1 lg:sticky lg:top-32 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:flex lg:max-h-[calc(100dvh-9rem)] lg:flex-col lg:self-start lg:pt-6"
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

							<div className="mt-6 hidden min-h-0 flex-1 flex-col border-t border-white/10 pt-5 lg:flex">
								<FindField
									inputRef={railFind}
									onFocus={armFind}
									query={query}
									onQuery={setQuery}
									placeholder={findPlaceholder}
									items={allFindItems}
									active={active}
									onActive={setActive}
									listId="find-rail"
								/>
								<h2 className={`${CAPTION} mt-5 px-2.5`}>
									{searching ? "Matches" : "On this page"}
								</h2>
								{/* The box reaches into the page's right margin, so the rail's side tabs show. */}
								<div
									ref={indexBox}
									className="relative mt-2 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)] [scrollbar-width:none] lg:-mr-8 lg:pr-8"
								>
									{searching ? (
										<FindResults
											listId="find-rail"
											query={query}
											items={allFindItems}
											busy={allFindBusy}
											active={active}
											onActive={setActive}
											example={example}
											onClear={() => clearFind(railFind.current)}
										/>
									) : (
										<TitleRail
											items={items}
											visible={visible}
											onJump={jump}
											media={media}
										/>
									)}
								</div>
							</div>
						</aside>

						{/* Every section in full. */}
						<div className="mt-10 flex min-w-0 flex-col gap-14 max-lg:order-3 lg:col-start-1 lg:row-start-2 lg:mt-14 lg:gap-16 lg:pl-6">
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
									{s.oldIds?.map((id) => (
										// Lands where the section does: its scroll margin plus its top padding.
										<span
											key={id}
											id={id}
											aria-hidden="true"
											className="block scroll-mt-[208px] lg:scroll-mt-[168px]"
										/>
									))}
									<SectionHeader
										anchor={s.id}
										icon={s.icon}
										title={s.heading ?? s.label}
										subtitle={s.subtitle}
										aside={s.aside}
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
			<SubPageLinks />
		</FindBus.Provider>
	)
}
