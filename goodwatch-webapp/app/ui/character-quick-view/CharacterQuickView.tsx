// The character quick view (opened through context.tsx): a click on a character shows the actor AND the character, the
// title the role is in, and more characters, before the person page.
//
// Wide screens: a card on the left and the character's portrait big on its right, Previous / Next under the portrait,
// both columns one height. The card leads with the actor's small photo, "Bryan Cranston plays" and the character's
// name; without a portrait of its own the big picture is the actor's photo and the small one is left out. The clicked
// picture lifts from its place in the page into the portrait's place (transform and opacity only), ← / → step, Escape
// or a tap outside closes, and closing flies the picture back. Phones: the poster quick view's bottom drawer.
// The grid of more characters is the actor's other roles, or on the person page the title's other top characters.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { foldName } from "~/domain/character-portraits"
import { useFocusScope } from "~/ui/for-you/focus"
import { DISPLAY } from "~/ui/my-pages/bits"
import {
	FrameContext,
	HeaderSteps,
	QuickView,
	StepButtons,
	type Steps,
	useQuickViewFrame,
} from "~/ui/quick-view/QuickView"
import { personPath, titlePath } from "~/utils/helpers"
import type { CharacterEntry, OpenCharacter } from "./context"
import { TvdbCredit } from "./parts"
import {
	type CharacterRole,
	fetchPersonRoles,
	useTitlePortraits,
} from "./portraits"

const TMDB = "https://image.tmdb.org/t/p"
const EASE = [0.22, 1, 0.36, 1] as const
const LIFT = { duration: 0.3, ease: EASE } as const
const BACK = { duration: 0.24, ease: EASE } as const
/** The wide view: the portrait (340 × 510) with Previous / Next under it, and the card beside it at that height. */
const STAGE = { w: 800, h: 570 }
const DRAWER_HEIGHT = 580

/** The actor's picture: the TMDB profile when known (2:3 at w342), else TheTVDB's photo. */
const actorSrc = (e: CharacterEntry) =>
	e.actorProfilePath
		? `${TMDB}/w342${e.actorProfilePath}`
		: (e.actorImage ?? undefined)

/** The character has a portrait of their own: not missing, and not the actor's photo again. */
const hasPortrait = (e: CharacterEntry) =>
	Boolean(e.image) && e.image !== actorSrc(e) && e.image !== e.actorImage

const titleHref = (e: CharacterEntry) =>
	e.title ? titlePath(e.title.mediaType, e.title.tmdbId, e.title.name) : null

/** The actor's page: from the id when the entry knows it (entries from the person page link a title page). */
const actorHref = (e: CharacterEntry) =>
	e.moreFrom === "title" && e.personId
		? personPath(e.personId, e.personName)
		: e.href

const initials = (name: string) =>
	name
		.split(/\s+/)
		.map((w) => w[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase()

/** A role from the actor's other characters, as an entry of its own (same person, same page). */
const roleEntry = (
	from: CharacterEntry,
	role: CharacterRole,
): CharacterEntry => ({
	anchor: `view-role-${role.mediaType}-${role.tmdbId}-${role.character}`,
	character: role.character,
	image: role.image,
	personName: from.personName,
	personId: from.personId ?? role.personTmdbId,
	actorProfilePath: from.actorProfilePath,
	actorImage: from.actorImage ?? role.actorImage,
	title: {
		mediaType: role.mediaType,
		tmdbId: role.tmdbId,
		name: role.title,
		year: role.year,
		posterPath: role.posterPath,
	},
	href: from.href,
})

/** The entry's element in the page: its data-character-anchor, or the clicked element for the entry that was clicked. */
function anchorEl(open: OpenCharacter, i: number): HTMLElement | null {
	const e = open.list[i]
	if (!e) return null
	const el = document.querySelector<HTMLElement>(
		`[data-character-anchor="${CSS.escape(e.anchor)}"]`,
	)
	if (el) return el
	return e.anchor === open.first && open.from.isConnected ? open.from : null
}

/** The biggest picture in an element (the anchor's image), or the element itself. */
function pictureIn(el: HTMLElement): HTMLElement {
	if (el instanceof HTMLImageElement) return el
	let best: HTMLImageElement | null = null
	let area = 0
	for (const img of el.querySelectorAll("img")) {
		const b = img.getBoundingClientRect()
		if (b.width * b.height > area) {
			area = b.width * b.height
			best = img
		}
	}
	return best ?? el
}

type Box = { x: number; y: number; w: number; h: number }
const boxOf = (el: Element): Box => {
	const b = el.getBoundingClientRect()
	return { x: b.left, y: b.top, w: b.width, h: b.height }
}
const inView = (b: Box) =>
	b.w > 0 &&
	b.y + b.h > 0 &&
	b.y < window.innerHeight &&
	b.x + b.w > 0 &&
	b.x < window.innerWidth

/** The view's picture drawn over box `b` (relative to its home box `t`). */
const over = (b: Box, t: Box) => ({
	x: b.x - t.x,
	y: b.y - t.y,
	scaleX: b.w / t.w,
	scaleY: b.h / t.h,
	opacity: 1,
})
const HOME = { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }

/** Which of the view's pictures the clicked one lifts into: a TMDB photo the actor's, a portrait the character's. */
function slotFor(open: OpenCharacter): "actor" | "character" {
	const entry = open.list[open.index]
	if (!entry || !hasPortrait(entry)) return "actor"
	const pic = pictureIn(open.from)
	const src = pic instanceof HTMLImageElement ? pic.currentSrc || pic.src : ""
	return src.includes("image.tmdb.org") ? "actor" : "character"
}

export default function CharacterQuickView({
	open,
	onIndex,
	onRole,
	onClose,
}: {
	open: OpenCharacter
	onIndex: (i: number) => void
	onRole: (e: CharacterEntry) => void
	onClose: () => void
}) {
	const card = (i: number) => <Card entry={open.list[i]} onRole={onRole} />
	if (!open.wide)
		return (
			<QuickView
				count={open.list.length}
				index={open.index}
				onIndex={onIndex}
				onClose={onClose}
				ordered={open.list.length > 1}
				wide={false}
				anchorOf={(i) => anchorEl(open, i)}
				focusOf={() => open.from}
				posterOf={(i) => ({
					path: open.list[i]?.image ?? null,
					name: open.list[i]?.character ?? "",
				})}
				height={{ h: 560, drawer: DRAWER_HEIGHT }}
			>
				{card}
			</QuickView>
		)
	return (
		<Stage open={open} onIndex={onIndex} onClose={onClose}>
			{card}
		</Stage>
	)
}

// --- the wide view: the clicked picture lifting into the view over the dimmed page ------------------------------

interface Ghost {
	id: number
	src: string
	home: Box
	from: ReturnType<typeof over>
	to: ReturnType<typeof over>
	back: boolean
	slot: HTMLElement
}

/** The card surface, as the poster quick view's. */
const SURFACE =
	"overflow-hidden rounded-2xl bg-gray-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,.95)] ring-1 ring-white/12"

function Stage({
	open,
	onIndex,
	onClose,
	children,
}: {
	open: OpenCharacter
	onIndex: (i: number) => void
	onClose: () => void
	children: (i: number) => ReactNode
}) {
	const [closing, setClosing] = useState(false)
	const [ghost, setGhost] = useState<Ghost | null>(null)
	const view = useRef<HTMLDivElement>(null)
	const layer = useRef<HTMLDivElement>(null)
	const count = open.list.length
	const latestOpen = useRef(open)
	latestOpen.current = open
	const slot = useRef(slotFor(open))

	/** The open entry's picture in the view (the newest layer, when a step is crossfading). */
	const slotEl = () => {
		const mine = view.current?.querySelectorAll<HTMLElement>(
			`[data-view-slot="${slot.current}"]`,
		)
		const any = view.current?.querySelectorAll<HTMLElement>("[data-view-slot]")
		return mine?.[mine.length - 1] ?? any?.[any.length - 1] ?? null
	}

	// Opening: the clicked picture flies from its place in the page into its place in the view.
	useLayoutEffect(() => {
		const a = anchorEl(open, open.index)
		const s = slotEl()
		if (!a || !s) return
		const pic = pictureIn(a)
		const src = pic instanceof HTMLImageElement ? pic.currentSrc || pic.src : ""
		if (!src) return
		const home = boxOf(s)
		s.style.visibility = "hidden"
		setGhost({
			id: 1,
			src,
			home,
			from: over(boxOf(pic), home),
			to: HOME,
			back: false,
			slot: s,
		})
	}, [])

	// The open entry's picture in the page hides while it is in the view.
	const hidden = useRef<HTMLElement | null>(null)
	useEffect(() => {
		const el = anchorEl(open, open.index)
		if (hidden.current && hidden.current !== el)
			hidden.current.style.visibility = ""
		if (el) el.style.visibility = "hidden"
		hidden.current = el
	}, [open])
	useEffect(
		() => () => {
			if (hidden.current) hidden.current.style.visibility = ""
		},
		[],
	)

	// The page behind doesn't scroll by wheel; the view's own scrolling region does.
	useEffect(() => {
		const el = layer.current
		if (!el) return
		const onWheel = (e: WheelEvent) => {
			const t =
				e.target instanceof Element
					? e.target.closest("[data-view-scroll]")
					: null
			if (!t || t.scrollHeight <= t.clientHeight) e.preventDefault()
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => el.removeEventListener("wheel", onWheel)
	}, [])

	const close = useCallback(() => {
		if (closing) return
		setClosing(true)
		const o = latestOpen.current
		const a = anchorEl(o, o.index)
		const s = slotEl()
		const img = s?.querySelector("img")
		const back = a ? boxOf(pictureIn(a)) : null
		if (s && img && back && inView(back)) {
			// Closing: the view's picture flies back into its place in the page.
			const home = boxOf(s)
			s.style.visibility = "hidden"
			setGhost({
				id: 2,
				src: img.currentSrc || img.src,
				home,
				from: HOME,
				to: over(back, home),
				back: true,
				slot: s,
			})
		} else if (hidden.current) {
			hidden.current.style.visibility = ""
			hidden.current = null
		}
	}, [closing])
	// The view is gone: the picture in the page shows again, and then focus goes back to the opener (a hidden element
	// can't take focus, so the focus scope's own return, when closing starts, can miss it).
	const finish = () => {
		if (hidden.current) hidden.current.style.visibility = ""
		hidden.current = null
		const to = open.from
		const now = document.activeElement
		if (
			to.isConnected &&
			(!now ||
				now === document.body ||
				!now.isConnected ||
				layer.current?.contains(now))
		)
			to.focus({ preventScroll: true })
		onClose()
	}
	const step = useCallback(
		(d: -1 | 1) => onIndex((open.index + d + count) % count),
		[open.index, count, onIndex],
	)
	const steps: Steps | null =
		count > 1 ? { onStep: step, canPrev: true, canNext: true } : null
	const latest = useRef({ step, close })
	latest.current = { step, close }
	useEffect(() => {
		if (closing) return
		const onKey = (e: KeyboardEvent) => {
			const t = e.target
			if (t instanceof Element && t.closest("input, textarea, select")) return
			if (e.key === "Escape") {
				e.stopImmediatePropagation()
				e.preventDefault()
				latest.current.close()
			} else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.stopImmediatePropagation()
				e.preventDefault()
				if (count > 1) latest.current.step(e.key === "ArrowLeft" ? -1 : 1)
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [closing, count])
	useFocusScope({
		active: !closing,
		scope: () => [layer.current],
		initial: () => view.current,
		returnTo: () => open.from,
	})
	const entry = open.list[open.index]
	return createPortal(
		<div ref={layer} className="fixed inset-0 z-[1200]" data-quick-view="">
			<motion.div
				className="absolute inset-0 bg-black/75"
				initial={{ opacity: 0 }}
				animate={{ opacity: closing ? 0 : 1 }}
				transition={{ duration: closing ? 0.2 : 0.24 }}
				onClick={close}
			/>
			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
				<motion.div
					ref={view}
					tabIndex={-1}
					// biome-ignore lint/a11y/useSemanticElements: a positioned card over the dimmed page, as the quick view's.
					role="dialog"
					aria-modal="true"
					aria-label={
						entry ? `${entry.personName} as ${entry.character}` : undefined
					}
					className="relative max-h-[calc(100dvh-6rem)] max-w-full outline-none"
					style={{ width: STAGE.w, height: STAGE.h }}
					// Opacity only: the lifting picture is the motion, and the place it lands in must not move.
					initial={{ opacity: 0 }}
					animate={{ opacity: closing ? 0 : 1 }}
					transition={{ duration: closing ? 0.18 : 0.22, ease: "easeOut" }}
					onAnimationComplete={() => {
						if (closing && !ghost?.back) finish()
					}}
				>
					<FrameContext.Provider value={{ form: "card", steps, close }}>
						<AnimatePresence initial={false}>
							<motion.div
								key={entry?.anchor}
								className="absolute inset-0 flex flex-col"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.18, ease: "easeOut" }}
							>
								{children(open.index)}
							</motion.div>
						</AnimatePresence>
					</FrameContext.Provider>
				</motion.div>
			</div>
			{ghost && (
				<motion.div
					key={ghost.id}
					aria-hidden
					className="pointer-events-none absolute origin-top-left overflow-hidden rounded-xl bg-gray-800 shadow-2xl"
					style={{
						left: ghost.home.x,
						top: ghost.home.y,
						width: ghost.home.w,
						height: ghost.home.h,
					}}
					initial={ghost.from}
					animate={ghost.to}
					transition={ghost.back ? BACK : LIFT}
					onAnimationComplete={() => {
						if (ghost.back) return finish()
						ghost.slot.style.visibility = ""
						setGhost(null)
					}}
				>
					<img
						src={ghost.src}
						alt=""
						draggable={false}
						className="size-full object-cover object-top"
					/>
				</motion.div>
			)}
		</div>,
		document.body,
	)
}

// --- the pictures and the names ---------------------------------------------------------------------------------

/** The actor's photo, 2:3, a link to their page. */
function ActorFrame({
	entry,
	className = "",
}: { entry: CharacterEntry; className?: string }) {
	const src = actorSrc(entry)
	return (
		<Link
			to={actorHref(entry)}
			aria-label={`${entry.personName}, open their page`}
			data-view-slot="actor"
			className={`group relative block aspect-[2/3] shrink-0 overflow-hidden rounded-xl bg-gray-800 ring-1 ring-white/15 ${className}`}
		>
			{src ? (
				<Img
					src={src}
					alt={entry.personName}
					className="transition-transform duration-200 group-hover:scale-[1.04]"
				/>
			) : (
				<span className="absolute inset-0 grid place-items-center text-2xl font-bold text-gray-500">
					{initials(entry.personName)}
				</span>
			)}
		</Link>
	)
}

/** The character's portrait, 2:3. */
function CharacterFrame({
	entry,
	className = "",
}: { entry: CharacterEntry; className?: string }) {
	return (
		<div
			data-view-slot="character"
			className={`relative aspect-[2/3] shrink-0 overflow-hidden rounded-xl bg-gray-800 ring-1 ring-white/15 ${className}`}
		>
			<Img
				src={entry.image}
				alt={`${entry.personName} as ${entry.character}`}
			/>
		</div>
	)
}

function ActorName({
	entry,
	className = "",
}: { entry: CharacterEntry; className?: string }) {
	return (
		<Link to={actorHref(entry)} className={`hover:text-amber-300 ${className}`}>
			{entry.personName}
		</Link>
	)
}

/** Previous / Next under the portrait, as the poster quick view has them under the poster. */
function PortraitSteps() {
	const { form, steps } = useQuickViewFrame()
	if (form !== "card" || !steps) return null
	return <StepButtons {...steps} />
}

/** The view's close (and, in a drawer, previous / next), top right. */
function Tools() {
	const { form, steps } = useQuickViewFrame()
	return (
		<div className="absolute top-2 right-2 z-10 flex gap-1.5">
			{steps && form === "drawer" && <HeaderSteps {...steps} />}
			<CloseButton />
		</div>
	)
}

/** The title row and the grid of more characters, scrolling when the card is short. */
function Body({
	entry,
	onRole,
}: {
	entry: CharacterEntry
	onRole: (e: CharacterEntry) => void
}) {
	return (
		<div
			data-view-scroll=""
			className="min-h-0 flex-1 divide-y divide-white/[0.07] overflow-y-auto overscroll-contain px-4"
		>
			<InTitle entry={entry} />
			<MoreCharacters entry={entry} onRole={onRole} />
		</div>
	)
}

// --- the card ---------------------------------------------------------------------------------------------------

function Card({
	entry,
	onRole,
}: {
	entry: CharacterEntry | undefined
	onRole: (e: CharacterEntry) => void
}) {
	const { form } = useQuickViewFrame()
	if (!entry) return null
	const two = hasPortrait(entry)

	if (form === "drawer")
		// Phones: one drawer, its head reading left to right: the actor, "plays", the character's portrait.
		return (
			<>
				<Tools />
				<div className="flex shrink-0 select-none items-end gap-3 px-4 pt-14 pb-2">
					<Heading entry={entry} big={false} />
					{two && <CharacterFrame entry={entry} className="w-24 rounded-lg" />}
				</div>
				<Body entry={entry} onRole={onRole} />
				<PageButton entry={entry} />
			</>
		)

	// The card on the left, the character's portrait big on its right.
	return (
		<div className="flex h-full items-stretch gap-5">
			<div
				className={`pointer-events-auto relative flex h-full min-w-0 flex-1 flex-col ${SURFACE}`}
			>
				<Tools />
				<div className="shrink-0 px-4 pt-5 pr-16 pb-2">
					<Heading entry={entry} big />
				</div>
				<Body entry={entry} onRole={onRole} />
				<PageButton entry={entry} />
			</div>
			<div className="pointer-events-auto flex w-[21.25rem] shrink-0 select-none flex-col justify-between gap-3">
				{two ? (
					<CharacterFrame
						entry={entry}
						className="w-full shadow-[0_30px_80px_-20px_rgba(0,0,0,.95)]"
					/>
				) : (
					<ActorFrame
						entry={entry}
						className="w-full shadow-[0_30px_80px_-20px_rgba(0,0,0,.95)]"
					/>
				)}
				<PortraitSteps />
			</div>
		</div>
	)
}

/**
 * The heading: the actor's small photo first, then "Bryan Cranston plays" and the character's name, which leads on to
 * the big portrait at the right. Without a portrait the big picture is the actor's, so the small one is left out.
 */
function Heading({ entry, big }: { entry: CharacterEntry; big: boolean }) {
	const two = hasPortrait(entry)
	return (
		<div className="flex min-w-0 flex-1 items-end gap-3">
			{(two || !big) && (
				<ActorFrame
					entry={entry}
					className={big ? "w-16 rounded-lg" : "w-14 rounded-lg"}
				/>
			)}
			<div className="min-w-0 pb-0.5">
				<p className="truncate text-sm text-gray-400">
					<ActorName entry={entry} className="font-semibold text-gray-100" />{" "}
					plays
				</p>
				<h2
					className={`${DISPLAY} line-clamp-2 leading-tight text-white ${big ? "text-[1.6rem]" : "text-[1.3rem]"}`}
				>
					{entry.character}
				</h2>
			</div>
		</div>
	)
}

// --- shared pieces ----------------------------------------------------------------------------------------------

function Label({ children }: { children: ReactNode }) {
	return (
		<p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-gray-500 uppercase">
			{children}
		</p>
	)
}

/** Close, in the look of the poster quick view's Details | close control. */
function CloseButton() {
	const { close } = useQuickViewFrame()
	return (
		<div className="flex h-10 items-stretch overflow-hidden rounded-xl border border-white/25 bg-gray-950/85">
			<button
				type="button"
				onClick={close}
				aria-label="Close"
				className="grid w-10 cursor-pointer place-items-center text-white hover:bg-white/15"
			>
				<XMarkIcon className="h-5 w-5" />
			</button>
		</div>
	)
}

function Img({
	src,
	alt = "",
	className = "",
}: { src?: string; alt?: string; className?: string }) {
	if (!src) return null
	return (
		<img
			src={src}
			alt={alt}
			decoding="async"
			draggable={false}
			className={`size-full object-cover object-top ${className}`}
		/>
	)
}

/** The title the role is in, with its poster. */
function InTitle({ entry }: { entry: CharacterEntry }) {
	const t = entry.title
	const href = titleHref(entry)
	if (!t || !href) return null
	return (
		<section className="py-3">
			<Label>In</Label>
			<Link
				to={href}
				className="group -mx-1.5 flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-white/[0.05]"
			>
				<span className="aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-md bg-gray-800 ring-1 ring-white/10">
					{t.posterPath && <Img src={`${TMDB}/w92${t.posterPath}`} />}
				</span>
				<span className="min-w-0">
					<span className="block truncate text-sm font-semibold text-gray-100 group-hover:text-amber-300">
						{t.name}
					</span>
					<span className="block text-xs text-gray-500">
						{[t.year, t.mediaType === "show" ? "TV show" : "Movie"]
							.filter(Boolean)
							.join(" · ")}
					</span>
				</span>
			</Link>
			{entry.facts?.length ? (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{entry.facts.map((f) => (
						<span
							key={f}
							className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] text-gray-300"
						>
							{f}
						</span>
					))}
				</div>
			) : null}
		</section>
	)
}

/** Columns of the grid of more characters, and its rows. */
const COLS = 5
const ROWS = 2

/** The grid of other characters: the actor's roles, or (moreFrom "title") the title's other top characters. */
function MoreCharacters(props: {
	entry: CharacterEntry
	onRole: (e: CharacterEntry) => void
}) {
	return props.entry.moreFrom === "title" && props.entry.title ? (
		<MoreFromTitle {...props} />
	) : (
		<ActorRoles {...props} />
	)
}

type Tile = {
	key: string
	image: string
	caption: string
	hint: string
	pick: () => void
}

/** A labelled grid of character tiles, up to two rows; placeholders while loading. */
function Grid({ label, tiles }: { label: string; tiles: Tile[] | null }) {
	return (
		<section className="py-3">
			<Label>{label}</Label>
			<div
				className="grid gap-x-2 gap-y-2.5"
				style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
			>
				{tiles
					? tiles.slice(0, COLS * ROWS).map((t) => (
							<button
								key={t.key}
								type="button"
								onClick={t.pick}
								title={t.hint}
								className="group min-w-0 cursor-pointer text-left"
							>
								<span className="block aspect-[2/3] overflow-hidden rounded-md bg-gray-800 ring-1 ring-white/10 transition-transform duration-150 group-hover:scale-[1.04]">
									<img
										src={t.image}
										alt={t.hint}
										width={300}
										height={450}
										loading="lazy"
										decoding="async"
										draggable={false}
										className="size-full object-cover object-top"
									/>
								</span>
								<span className="mt-1 block truncate text-[11px] text-gray-400 group-hover:text-white">
									{t.caption}
								</span>
							</button>
						))
					: Array.from({ length: COLS }, (_, i) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								key={i}
								className="block aspect-[2/3] animate-pulse rounded-md bg-white/[0.05]"
							/>
						))}
			</div>
		</section>
	)
}

type CastRow = {
	id: number
	name: string
	profilePath: string | null
	roles: string[]
}

/** The title's characters with portraits, in billing order (the cast's first page, matched by actor name). */
function MoreFromTitle({
	entry,
	onRole,
}: {
	entry: CharacterEntry
	onRole: (e: CharacterEntry) => void
}) {
	const t = entry.title as NonNullable<CharacterEntry["title"]>
	const portraits = useTitlePortraits(t.mediaType, t.tmdbId)
	const cast = useQuery({
		queryKey: ["character-view-title-cast", t.mediaType, t.tmdbId],
		queryFn: async () => {
			const p = new URLSearchParams({
				type: t.mediaType,
				id: String(t.tmdbId),
				kind: "cast",
				q: "",
				group: "",
				offset: "0",
				limit: "96",
			})
			const r = await fetch(`/api/title-people?${p}`)
			if (!r.ok) throw new Error(`Title people answered ${r.status}`)
			return ((await r.json()) as { rows: CastRow[] }).rows
		},
	})
	// Without the cast (a failed read) the portraits keep their own order; without the portraits there is no grid.
	const ready = portraits.ready && !cast.isPending
	const rows = cast.data ?? []
	const at = new Map(rows.map((r, i) => [foldName(r.name), i]))
	const others = portraits.all
		.filter(
			(p) =>
				!(
					foldName(p.character) === foldName(entry.character) &&
					foldName(p.personName) === foldName(entry.personName)
				),
		)
		.map((p) => ({
			p,
			i: at.get(foldName(p.personName)) ?? Number.MAX_SAFE_INTEGER,
		}))
		.sort((a, b) => a.i - b.i)
	const seen = new Set<string>()
	const list = others.filter(({ p }) => {
		const k = foldName(p.personName)
		if (seen.has(k)) return false
		seen.add(k)
		return true
	})
	if (portraits.failed || (ready && !list.length)) return null
	const toEntry = (
		p: (typeof list)[number]["p"],
		i: number,
	): CharacterEntry => {
		const row = i < rows.length ? rows[i] : undefined
		return {
			anchor: `view-title-${t.mediaType}-${t.tmdbId}-${p.character}`,
			character: p.character,
			image: p.image,
			personName: p.personName,
			personId: row?.id ?? p.personTmdbId,
			actorProfilePath: row?.profilePath ?? null,
			actorImage: p.actorImage,
			title: t,
			href: entry.href,
			moreFrom: "title",
		}
	}
	return (
		<Grid
			label={`More from ${t.name}`}
			tiles={
				ready
					? list.map(({ p, i }) => ({
							key: `${p.personName}-${p.character}`,
							image: p.image,
							caption: p.character,
							hint: `${p.personName} as ${p.character}`,
							pick: () => onRole(toEntry(p, i)),
						}))
					: null
			}
		/>
	)
}

/** The actor's other characters, best known first; a press steps the view to one. */
function ActorRoles({
	entry,
	onRole,
}: {
	entry: CharacterEntry
	onRole: (e: CharacterEntry) => void
}) {
	const q = useQuery({
		queryKey: ["character-view-roles", entry.personId ?? 0, entry.personName],
		// Two full rows, and one more for the role already open.
		queryFn: () =>
			fetchPersonRoles(entry.personId, entry.personName, COLS * ROWS + 1).then(
				(d) => d.characters,
			),
	})
	const roles = (q.data ?? []).filter(
		(r) =>
			!(
				entry.title &&
				r.mediaType === entry.title.mediaType &&
				r.tmdbId === entry.title.tmdbId
			),
	)
	// A failed read leaves the optional grid out rather than pulsing on.
	if (q.isError || (q.isSuccess && !roles.length)) return null
	return (
		<Grid
			label={`More roles of ${entry.personName}`}
			tiles={
				q.isSuccess
					? roles.map((r) => ({
							key: `${r.mediaType}-${r.tmdbId}`,
							image: r.image,
							caption: r.character,
							hint: `${entry.personName} as ${r.character} in ${r.title}`,
							pick: () => onRole(roleEntry(entry, r)),
						}))
					: null
			}
		/>
	)
}

function PageButton({ entry }: { entry: CharacterEntry }) {
	const label =
		entry.moreFrom === "title" && entry.title
			? `Open ${entry.title.name} ›`
			: `Open ${entry.personName}’s page ›`
	return (
		<div className="shrink-0 border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
			<Link
				to={entry.href}
				className="flex h-11 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-gray-950 hover:bg-amber-300"
			>
				{label}
			</Link>
			<TvdbCredit className="mt-2 text-center" />
		</div>
	)
}
