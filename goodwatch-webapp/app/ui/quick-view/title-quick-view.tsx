// The quick view for any poster card on a touch screen. Every card (MovieTvCard) registers with the provider, which
// sits in root.tsx around the app; a tap on a card's poster opens the quick view on it (TitleQuickView.tsx, loaded on
// first use). Cards with the page's own view of the title (`onOpen`) or without actions don't register. Previous /
// next step through the cards of the same list in page order: the shown cards inside the nearest element around the
// card (up to six levels) that holds others. The view keeps the titles it opened with, so a list that reloads under
// it (a title marked Seen leaving a list) doesn't empty it. A change of page closes the view, and so does any link
// pressed in it.
//
// After the first touch on the page, the cards on screen (and 300 px around it) are fetched ahead from
// /api/title-cards in one request at a time, through the query cache that the view reads, so the view opens with its
// backdrop, runtime, taste match and services in place and nothing is asked twice.
import { useLocation } from "@remix-run/react"
import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import {
	type MouseEvent,
	type ReactNode,
	Suspense,
	createContext,
	lazy,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import type { TitleCardsAnswer } from "~/server/title-cards-request.server"
import type { TitleCard } from "~/server/title-cards.server"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { TitleKey } from "~/utils/title-key"

/** What a card knows of its title: enough for the view's head while the rest loads. */
export interface PosterTitle {
	key: TitleKey
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	poster: string | null
	year: number | null
	goodwatch: number | null
	href: string
}

export interface OpenTitles {
	/** The cards of the list, in page order; one that left the page has no poster to lift or return focus to. */
	cards: HTMLElement[]
	/** Their titles, as they were at the opening. */
	titles: PosterTitle[]
	index: number
	/** A wide screen gets the card beside the lifted poster; a phone gets the bottom drawer. */
	wide: boolean
}

export interface TitleQuickViewApi {
	register: (card: HTMLElement, title: PosterTitle) => () => void
	open: (card: HTMLElement) => void
}

/** The most keys one /api/title-cards request may name (MAX_KEYS of title-cards.server.ts). */
const MAX_KEYS = 60
/** The view's cards stay this long before they are asked for again. */
export const CARD_STALE_MS = 5 * 60 * 1000

export const cardQueryKey = (
	viewer: string,
	language: string,
	key: TitleKey,
) => ["title-quick-view", viewer, language, key]

/** The cards for some titles, for the viewer: a member by session, a guest with the progress their browser holds. */
export async function fetchTitleCards(
	keys: TitleKey[],
	member: boolean,
	language: string,
): Promise<TitleCard[]> {
	const response = await fetch(
		mediaLanguageUrl(`/api/title-cards?keys=${keys.join(",")}`, language),
		member
			? undefined
			: {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ guest: snapshotGuestProgress() }),
				},
	)
	if (!response.ok) throw new Error(`Title cards: ${response.status}`)
	return ((await response.json()) as TitleCardsAnswer).cards
}

/** Who and in which language the cards are for, and how to fetch the ones not in the cache yet. */
export interface CardLoader {
	viewer: string
	language: string
	member: boolean
	load: (keys: TitleKey[]) => void
}

function useCardLoader(client: QueryClient): CardLoader {
	const { user } = useUser()
	const { locale } = useLocale()
	const viewer = user?.id ?? "guest"
	const member = Boolean(user)
	const language = locale.language
	return useMemo(() => {
		const load = (keys: TitleKey[]) => {
			// Cached and fresh, or on its way: nothing to ask.
			const fresh = keys.filter((key) => {
				const state = client.getQueryState(cardQueryKey(viewer, language, key))
				if (state?.fetchStatus === "fetching") return false
				return (
					!state?.dataUpdatedAt ||
					state.dataUpdatedAt < Date.now() - CARD_STALE_MS
				)
			})
			for (let i = 0; i < fresh.length; i += MAX_KEYS) {
				const chunk = fresh.slice(i, i + MAX_KEYS)
				// One request for the chunk; each title's query waits on it, so the view's own query joins it.
				const batch = fetchTitleCards(chunk, member, language).then(
					(cards) => new Map(cards.map((c) => [c.key, c])),
				)
				for (const key of chunk)
					void client.prefetchQuery({
						queryKey: cardQueryKey(viewer, language, key),
						// A title the catalog lacks is null: the view shows what the card knew.
						queryFn: () => batch.then((byKey) => byKey.get(key) ?? null),
						staleTime: CARD_STALE_MS,
					})
			}
		}
		return { viewer, language, member, load }
	}, [client, viewer, language, member])
}

/** The list a card belongs to: the shown cards in the nearest element around it that holds others, in page order. */
function listOf(
	card: HTMLElement,
	cards: Map<HTMLElement, PosterTitle>,
): HTMLElement[] {
	const all = [...cards.keys()].filter(
		(c) => c === card || (c.isConnected && c.getClientRects().length > 0),
	)
	let box: HTMLElement | null = null
	// A card alone this far up stands alone: the page's other cards are another list.
	let up = card.parentElement
	for (let depth = 0; !box && up && depth < 6; depth++, up = up.parentElement)
		if (all.some((c) => c !== card && up?.contains(c))) box = up
	const inside = box ? all.filter((c) => box?.contains(c)) : [card]
	return inside.sort((a, b) =>
		a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
	)
}

const importView = () => import("./TitleQuickView")
const TitleQuickView = lazy(reloadOnStaleChunk(importView))

const Context = createContext<TitleQuickViewApi | null>(null)
export const useTitleQuickView = () => useContext(Context)

export function TitleQuickViewProvider({ children }: { children: ReactNode }) {
	const client = useQueryClient()
	const loader = useCardLoader(client)
	const loaderRef = useRef(loader)
	loaderRef.current = loader
	const cards = useRef(new Map<HTMLElement, PosterTitle>())
	const [open, setOpen] = useState<OpenTitles | null>(null)
	const { pathname } = useLocation()

	// The cards in sight are fetched ahead once someone touches the page: a tap is what opens them, and a crawler or a
	// visitor who only reads asks for nothing.
	const [touched, setTouched] = useState(false)
	useEffect(() => {
		const on = () => setTouched(true)
		window.addEventListener("touchstart", on, { passive: true, once: true })
		return () => window.removeEventListener("touchstart", on)
	}, [])
	const observer = useRef<IntersectionObserver | null>(null)
	useEffect(() => {
		if (!touched) return
		const seen = new Set<TitleKey>()
		let timer = 0
		const watch = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const title = cards.current.get(entry.target as HTMLElement)
					if (title && entry.isIntersecting) seen.add(title.key)
				}
				window.clearTimeout(timer)
				timer = window.setTimeout(() => {
					const keys = [...seen]
					seen.clear()
					if (keys.length) loaderRef.current.load(keys)
				}, 120)
			},
			{ rootMargin: "300px 0px" },
		)
		for (const card of cards.current.keys()) watch.observe(card)
		observer.current = watch
		return () => {
			window.clearTimeout(timer)
			watch.disconnect()
			observer.current = null
		}
	}, [touched])

	const api = useMemo<TitleQuickViewApi>(
		() => ({
			register: (card, title) => {
				cards.current.set(card, title)
				observer.current?.observe(card)
				return () => {
					cards.current.delete(card)
					observer.current?.unobserve(card)
				}
			},
			open: (card) => {
				const list = listOf(card, cards.current)
				const titles = list.map((c) => cards.current.get(c))
				if (titles.some((t) => !t)) return
				setOpen({
					cards: list,
					titles: titles as PosterTitle[],
					index: Math.max(0, list.indexOf(card)),
					wide: window.matchMedia("(min-width: 768px)").matches,
				})
			},
		}),
		[],
	)

	// The titles around the open one, ahead of a step.
	useEffect(() => {
		if (!open) return
		loader.load(
			open.titles
				.slice(Math.max(0, open.index - 4), open.index + 5)
				.map((t) => t.key),
		)
	}, [open, loader])

	// Another page: the view goes with the page it was opened on.
	useEffect(() => setOpen(null), [pathname])
	// A link pressed inside the view (the head, a reason chip) closes it at once, even when it leads to the page
	// already open. React's capture phase reaches here through the view's portal.
	const onClickCapture = (e: MouseEvent) => {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return
		if (
			e.target instanceof Element &&
			e.target.closest('a[href]:not([target="_blank"])')
		)
			setOpen(null)
	}
	return (
		<Context.Provider value={api}>
			{children}
			{open && (
				<div className="contents" onClickCapture={onClickCapture}>
					<Suspense fallback={null}>
						<TitleQuickView
							open={open}
							loader={loader}
							onIndex={(index) => setOpen((o) => (o ? { ...o, index } : o))}
							onClose={() => setOpen(null)}
						/>
					</Suspense>
				</div>
			)}
		</Context.Provider>
	)
}

/** Starts loading the view's code at the first touch on a card; a failure waits for the opening. */
export const preloadTitleQuickView = () => {
	importView().catch(() => {})
}
