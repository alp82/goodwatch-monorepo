// The character quick view's entry point. Any surface that shows a character portrait (the cast list, the Starring
// faces, the person page's Characters shelf) renders it inside a link to the person or title page, and a plain click
// calls open() with what it knows instead; the view (CharacterQuickView.tsx, loaded on first use) does the rest.
// A modified click, a crawler and a page without the provider follow the link.
//
//   const view = useCharacterQuickView()
//   <CharacterLink entry={entry} siblings={entries}>…</CharacterLink>
//
// `siblings` are the other characters in the same strip or grid, in screen order, so the view can step with ← / →
// like the poster quick view does; each needs its own `anchor` (the link's data-character-anchor).
// The provider sits in root.tsx around the app. A change of page closes the view, and so does any link pressed in it.
import { Link, useLocation } from "@remix-run/react"
import {
	type MouseEvent,
	type ReactNode,
	Suspense,
	createContext,
	lazy,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

export interface CharacterEntry {
	/** Stable within the page, e.g. "cast-show-1396-17419"; also the link's data-character-anchor value. */
	anchor: string
	character: string
	/** TheTVDB portrait (300×450), or the actor's photo when there is no portrait. */
	image: string
	personName: string
	/** TMDB person id when known (cast rows have it; search matches often don't). */
	personId?: number | null
	/** TMDB profile path of the actor, when known. */
	actorProfilePath?: string | null
	/** TheTVDB actor photo, the fallback when there is no TMDB one. */
	actorImage?: string | null
	/** The title this role is in. */
	title?: {
		mediaType: "movie" | "show"
		tmdbId: number
		name: string
		year?: number | string | null
		posterPath?: string | null
	}
	/** "62 episodes", "Main cast", … any short facts the surface has. */
	facts?: string[]
	/** Where the link goes: the person page, or on the person page the title page. */
	href: string
	/**
	 * What the view's grid of more characters shows: "person" (default) the actor's other roles; "title" the title's
	 * other top characters (on the person page, where the actor is already known).
	 */
	moreFrom?: "person" | "title"
}

export interface OpenCharacter {
	list: CharacterEntry[]
	index: number
	/** A wide screen gets the centered view; a phone gets the bottom drawer. */
	wide: boolean
	/** The element clicked: focus goes back to it, and it is the first entry's slot when it has no anchor. */
	from: HTMLElement
	/** The entry that was clicked (a role added later has no place in the page). */
	first: string
}

export interface CharacterQuickViewApi {
	open: (
		entry: CharacterEntry,
		from: HTMLElement,
		siblings?: CharacterEntry[],
	) => void
}

const importView = () => import("./CharacterQuickView")
const CharacterQuickView = lazy(reloadOnStaleChunk(importView))

/** Starts loading the view's code on a pointer or focus over a character; a failure waits for the click. */
export const preloadCharacterQuickView = () => {
	importView().catch(() => {})
}

const Context = createContext<CharacterQuickViewApi | null>(null)
export const useCharacterQuickView = () => useContext(Context)

export function CharacterQuickViewProvider({
	children,
}: { children: ReactNode }) {
	const [open, setOpen] = useState<OpenCharacter | null>(null)
	const { pathname } = useLocation()
	const api = useMemo<CharacterQuickViewApi>(
		() => ({
			open: (entry, from, siblings) => {
				let list = siblings?.length ? siblings : [entry]
				let index = list.findIndex((e) => e.anchor === entry.anchor)
				if (index < 0) {
					list = [entry]
					index = 0
				}
				setOpen({
					list,
					index,
					from,
					first: entry.anchor,
					wide: window.matchMedia("(min-width: 768px)").matches,
				})
			},
		}),
		[],
	)
	// Another page: the view goes with the page it was opened on (a back button, a link from anywhere).
	useEffect(() => setOpen(null), [pathname])
	// A link pressed inside the view (the actor, the title, the page button) closes it at once, even when it leads to
	// the page already open. React's capture phase reaches here through the view's portal.
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
						<CharacterQuickView
							key={open.first}
							open={open}
							onIndex={(index) => setOpen((o) => (o ? { ...o, index } : o))}
							onRole={(entry) =>
								setOpen((o) => {
									if (!o) return o
									// The role goes right after the open one, and the view steps to it.
									const at = o.list.findIndex((e) => e.anchor === entry.anchor)
									if (at >= 0) return { ...o, index: at }
									const list = [...o.list]
									list.splice(o.index + 1, 0, entry)
									return { ...o, list, index: o.index + 1 }
								})
							}
							onClose={() => setOpen(null)}
						/>
					</Suspense>
				</div>
			)}
		</Context.Provider>
	)
}

const plainClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey

/**
 * A link to the entry's page (crawlable, and what a modified click opens) whose plain click opens the character quick
 * view instead. Without an entry, or outside the provider, it is a plain link to `href`.
 */
export function CharacterLink({
	entry,
	siblings,
	href,
	label,
	className,
	children,
	personId,
}: {
	entry: CharacterEntry | null
	siblings?: CharacterEntry[]
	/** Where the link goes; the entry's href by default. */
	href?: string
	label?: string
	className?: string
	children: ReactNode
	/** Marks the link for Find's ring and the At a glance row (data-person-id). */
	personId?: number
}) {
	const view = useCharacterQuickView()
	const to = href ?? entry?.href ?? "#"
	return (
		<Link
			to={to}
			// A plain click opens the view, so only a link that navigates fetches ahead.
			prefetch={entry && view ? "none" : "intent"}
			aria-label={label}
			data-person-id={personId}
			data-character-anchor={entry?.anchor}
			onPointerEnter={entry ? preloadCharacterQuickView : undefined}
			onFocus={entry ? preloadCharacterQuickView : undefined}
			onClick={(event) => {
				if (!entry || !view || !plainClick(event)) return
				event.preventDefault()
				event.stopPropagation()
				view.open(entry, event.currentTarget, siblings)
			}}
			className={className}
		>
			{children}
		</Link>
	)
}
