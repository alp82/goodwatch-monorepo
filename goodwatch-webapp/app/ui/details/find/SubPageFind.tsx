// Find in this title on a sub-page: the title page's own field (Find.tsx), in the sub-page's rail above its nav (and
// on a phone above its content). It finds this sub-page's matches first ("here": pointed at and rung in place), then
// the title page's (its whole index, built here as the title page builds it, and the cast and crew from the server:
// picking one goes back to the page and lands there), then the other sub-pages' (in through the router, landing
// there).
import {
	DocumentTextIcon,
	FingerPrintIcon,
	MagnifyingGlassIcon,
	PlayIcon,
	SparklesIcon,
	Squares2X2Icon,
	StarIcon,
	TagIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import { useNavigate } from "@remix-run/react"
import {
	type ComponentType,
	type ReactNode,
	useMemo,
	useRef,
	useState,
} from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { keptIcons } from "~/ui/details/rail/rail-model"
import { useStreamNames } from "~/ui/details/streaming"
import {
	AT_A_GLANCE,
	type SubKind,
	subPagePath,
} from "~/ui/details/sub-page/paths"
import type { WayBack } from "~/ui/details/sub-page/way-back"
import {
	FIND_ONLY_SECTIONS,
	scoresEntry,
	summaryEntry,
	useTitleSections,
} from "~/ui/details/title-sections"
import { useTitleQuestions } from "~/ui/details/useTitleQuestions"
import { FindField, FindResults, useFindItems } from "./Find"
import { type FindGrid, type FindSection, buildFindIndex } from "./find-index"
import { goPage, goSub, land } from "./landing"
import { markHl } from "./marks"
import { shelfEntries } from "./sub-page-index"
import { keptPageIndex, titleKey, useCrossFind } from "./useSubPageFind"

type Media = MovieResult | ShowResult

/** The title page's section icons, for a sub-page loaded without the title page before it. */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
	trailer: PlayIcon,
	scores: StarIcon,
	summary: DocumentTextIcon,
	watch: TvIcon,
	fingerprint: FingerPrintIcon,
	"at-a-glance": DocumentTextIcon,
	facts: DocumentTextIcon,
	cast: DocumentTextIcon,
	crew: DocumentTextIcon,
	tropes: TagIcon,
	episodes: Squares2X2Icon,
	"more-like-this": SparklesIcon,
}

/** At a glance's rows, which find's own sections are on the title page (TitlePage.tsx). */
const IN_GLANCE = new Set(FIND_ONLY_SECTIONS.map((s) => s.id))

const body = () => document.querySelector<HTMLElement>("[data-sub-body]")

export function SubFind({
	media,
	country,
	kind,
	back,
	listId,
	children,
	findGrid,
}: {
	media: Media
	country: string
	kind: SubKind
	back: WayBack
	listId: string
	/** What the rail shows while nothing is being found (the sub-page's nav). */
	children?: ReactNode
	/** A show's episodes from the sub-page's loader; null for a movie. */
	findGrid: FindGrid | null
}) {
	const navigate = useNavigate()
	const [query, setQuery] = useState("")
	const [active, setActive] = useState(0)
	const [focused, setFocused] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	const questions = useTitleQuestions(media, country)
	const { stream, rentBuy } = useStreamNames(media, country)
	const searching = query.trim().length > 0
	const armed = focused || searching
	// The title page's sections, from this page's data. Only whether there are episodes is read of the grid; the
	// sections' bodies are never drawn here.
	const titleSections = useTitleSections({
		media,
		country,
		shownCountry: country,
		offersPreview: null,
		episodeGrid: findGrid as unknown as EpisodeGrid | null,
		questions,
		sides: null,
	})
	const index = useMemo(() => {
		if (!armed) return null
		const kept = keptPageIndex(titleKey(media))
		const all: FindSection[] = [
			scoresEntry(media),
			summaryEntry(media),
			...titleSections.map(({ id, label, peek, aliases }) => ({
				id,
				label,
				peek,
				aliases,
			})),
			...FIND_ONLY_SECTIONS,
		]
		const entries = [
			...buildFindIndex({
				media,
				country,
				sections: all,
				// The questions' answers aren't on the title page.
				questions: [],
				grid: findGrid,
				stream,
				rentBuy,
			}),
			...shelfEntries(),
		]
		// What the title page found that this page has no data for (its shelves' titles, when it had them).
		const mine = new Set(all.map((x) => x.id))
		if (kept) entries.push(...kept.entries.filter((e) => !mine.has(e.section)))
		// The title page's own names for its sections where it kept them, its usual ones otherwise.
		const names = new Map(all.map((x) => [x.id, x.label]))
		for (const x of kept?.sections ?? []) names.set(x.id, x.label)
		for (const id of IN_GLANCE) names.set(id, AT_A_GLANCE)
		return {
			entries,
			sections: [...names].map(([id, label]) => ({ id, label })),
		}
	}, [armed, media, country, findGrid, stream.length, rentBuy.length])
	const sections = (index?.sections ?? []).map((s) => ({
		...s,
		icon: keptIcons.get(s.id) ?? ICONS[s.id] ?? MagnifyingGlassIcon,
	}))
	const reset = () => {
		// The picked words are marked where it lands (?hl=).
		markHl(query)
		setQuery("")
		setActive(0)
		input.current?.blur()
	}
	const page = useFindItems({
		media,
		query,
		index: index?.entries ?? [],
		sections,
		onHit: (hit) => {
			reset()
			goPage(
				back.to,
				{
					section: hit.entry.section,
					needle: hit.entry.needle,
					selector: hit.entry.selector,
				},
				navigate,
			)
		},
		onPerson: (k, row) => {
			reset()
			goPage(
				back.to,
				{ section: k, person: { kind: k, id: row.id, name: row.name } },
				navigate,
			)
		},
		onCastSearch: (q) => {
			reset()
			goPage(back.to, { section: "cast", castSearch: q }, navigate)
		},
	})
	const cross = useCrossFind({
		media,
		country,
		questions,
		query,
		armed,
		here: kind,
		onPick: (e) => {
			reset()
			if (e.sub === kind) land(e.go, body)
			else goSub(subPagePath(e.sub, media), e.go, null, navigate)
		},
	})
	const items = [...cross.own, ...page.items, ...cross.items]
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
				<FindField
					inputRef={input}
					query={query}
					onQuery={setQuery}
					placeholder="Find in this title"
					items={items}
					active={active}
					onActive={setActive}
					listId={listId}
				/>
			</div>
			{searching ? (
				<div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [scrollbar-width:none]">
					<FindResults
						listId={listId}
						query={query}
						items={items}
						busy={page.busy || cross.busy}
						active={active}
						onActive={setActive}
						example={
							kind === "tropes"
								? "a trope"
								: kind === "fingerprint"
									? "a feeling"
									: "a fact"
						}
						onClear={() => {
							setQuery("")
							input.current?.focus()
						}}
					/>
				</div>
			) : (
				children
			)}
		</div>
	)
}
