// The genre cloud: a chip per genre page, movies and shows apart, each chip a link with the genre's name. One peek (three
// posters fanned, and their names) sits above the chip being hovered, focused, or tapped, and glides between chips by
// transform. On a touch screen the first tap opens the peek and the second (on the chip or the peek) opens the genre;
// a tap elsewhere or Escape closes it. The peek overlays the cloud, so nothing reflows.
import { Link } from "@remix-run/react"
import {
	type CSSProperties,
	type MouseEvent,
	useEffect,
	useRef,
	useState,
} from "react"
import { RailHead } from "./Rail"
import { Fan, Poster } from "./Rails"
import {
	BROWSE_HUBS,
	type BrowseGenre,
	type BrowseKind,
	genreHref,
} from "./browse-data"

/** The peek's box (start.css `.sb-peek`). */
const PEEK_W = 168
const PEEK_H = 170

type Peek = {
	id: string
	kind: BrowseKind
	genre: BrowseGenre
	x: number
	y: number
	byTap: boolean
}

const canHover = () => window.matchMedia("(hover: hover)").matches

const GROUPS: { kind: BrowseKind; label: string; all: string; href: string }[] =
	[
		{
			kind: "movie",
			label: "Movies",
			all: "All movie genres",
			href: BROWSE_HUBS.movieGenres,
		},
		{
			kind: "show",
			label: "Shows",
			all: "All show genres",
			href: BROWSE_HUBS.showGenres,
		},
	]

export function GenreCloud({
	genres,
}: { genres: Record<BrowseKind, BrowseGenre[]> }) {
	const box = useRef<HTMLDivElement>(null)
	const [peek, setPeek] = useState<Peek | null>(null)

	const open = Boolean(peek)
	const byTap = Boolean(peek?.byTap)
	// Escape closes any peek, whether a hover, a focus, or a tap opened it.
	useEffect(() => {
		if (!open) return
		const onKey = (event: KeyboardEvent) =>
			event.key === "Escape" && setPeek(null)
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [open])
	// A tap elsewhere closes a tapped peek.
	useEffect(() => {
		if (!byTap) return
		const close = (event: PointerEvent) => {
			if (
				!(event.target instanceof Element) ||
				!event.target.closest("[data-genre]")
			)
				setPeek(null)
		}
		document.addEventListener("pointerdown", close)
		return () => document.removeEventListener("pointerdown", close)
	}, [byTap])

	const groups = GROUPS.filter((group) => genres[group.kind].length)
	if (!groups.length) return null

	const show = (
		el: HTMLElement,
		kind: BrowseKind,
		genre: BrowseGenre,
		byTap: boolean,
	) => {
		const host = box.current
		if (!host) return
		const outer = host.getBoundingClientRect()
		const chip = el.getBoundingClientRect()
		const x = Math.min(
			Math.max(chip.left - outer.left + chip.width / 2 - PEEK_W / 2, 0),
			Math.max(outer.width - PEEK_W, 0),
		)
		const y = chip.top - outer.top - PEEK_H - 6
		setPeek({ id: `${kind}-${genre.path}`, kind, genre, x, y, byTap })
	}

	const tap = (
		event: MouseEvent<HTMLAnchorElement>,
		kind: BrowseKind,
		genre: BrowseGenre,
	) => {
		if (canHover()) return
		// The second tap on the chip follows its link.
		if (peek?.byTap && peek.id === `${kind}-${genre.path}`) return
		event.preventDefault()
		show(event.currentTarget, kind, genre, true)
	}

	return (
		<section aria-labelledby="sb-genres">
			<RailHead
				id="sb-genres"
				title="Genres"
				line="Hover or tap one for a look inside"
			/>
			<div
				ref={box}
				className="sb-cloud"
				onPointerLeave={(event) =>
					event.pointerType === "mouse" && !peek?.byTap && setPeek(null)
				}
			>
				{groups.map((group) => (
					<div key={group.kind}>
						<p className="sb-group">
							{group.label}
							<Link to={group.href} discover="none">
								{group.all} <span aria-hidden>→</span>
							</Link>
						</p>
						<ul className="sb-chips">
							{genres[group.kind].map((genre) => {
								const on = peek?.id === `${group.kind}-${genre.path}`
								return (
									<li key={genre.path}>
										<Link
											to={genreHref(group.kind, genre.path)}
											discover="none"
											data-genre=""
											data-on={on ? "" : undefined}
											aria-describedby={on ? "sb-peek" : undefined}
											onPointerEnter={(event) =>
												event.pointerType === "mouse" &&
												show(event.currentTarget, group.kind, genre, false)
											}
											onFocus={(event) =>
												canHover() &&
												show(event.currentTarget, group.kind, genre, false)
											}
											onBlur={() => !peek?.byTap && setPeek(null)}
											onClick={(event) => tap(event, group.kind, genre)}
										>
											<span aria-hidden>
												{genre.titles.slice(0, 2).map((title) => (
													<Poster
														key={title.poster_path}
														path={title.poster_path}
														size="w92"
													/>
												))}
											</span>
											{genre.name}
										</Link>
									</li>
								)
							})}
						</ul>
					</div>
				))}
				<GenrePeek peek={peek} />
			</div>
		</section>
	)
}

/** The one peek: mounted once a chip was hovered, moved by transform, faded by opacity. */
function GenrePeek({ peek }: { peek: Peek | null }) {
	const last = useRef<Peek | null>(null)
	// It glides between chips while it shows; after it was hidden it appears in place (a fade only).
	const [wasOn, setWasOn] = useState(false)
	useEffect(() => {
		const frame = requestAnimationFrame(() => setWasOn(Boolean(peek)))
		return () => cancelAnimationFrame(frame)
	}, [peek])
	if (peek) last.current = peek
	const shown = peek ?? last.current
	if (!shown) return null
	const style: CSSProperties = {
		transform: `translate3d(${shown.x}px, ${shown.y}px, 0)`,
		opacity: peek ? 1 : 0,
		pointerEvents: peek?.byTap ? "auto" : "none",
	}
	const className = wasOn && peek ? "sb-peek sb-glide" : "sb-peek"
	const inner = (
		<>
			<Fan
				key={shown.id}
				posters={shown.genre.titles.map((title) => title.poster_path)}
				className="sb-peek-fan"
			/>
			<span>
				{peek?.byTap ? (
					<>
						Open {shown.genre.name} <span aria-hidden>→</span>
					</>
				) : (
					shown.genre.titles.map((title) => title.title).join(" · ")
				)}
			</span>
		</>
	)
	return peek?.byTap ? (
		<Link
			id="sb-peek"
			data-genre=""
			to={genreHref(shown.kind, shown.genre.path)}
			discover="none"
			className={className}
			style={style}
		>
			{inner}
		</Link>
	) : (
		<div
			id="sb-peek"
			role="tooltip"
			aria-hidden={!peek}
			className={className}
			style={style}
		>
			{inner}
		</div>
	)
}
