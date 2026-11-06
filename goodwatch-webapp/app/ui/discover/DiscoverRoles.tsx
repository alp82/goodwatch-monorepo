// Discover with a cast filter on (?people=<id>; the first person counts): above the results, a strip of the characters
// that person plays among them, TheTVDB's portraits with arrows on a wide screen. It leads every layout: the plain grid
// and the rows of a member's taste groups alike (DiscoverPage.tsx wraps both). A press scrolls to that title's first
// card and rings it for a moment, with "as Walter White" under it; a title without a card on the page opens the
// character quick view instead. Without a cast filter, or without portraits among the results, nothing shows. The first view gets the roles from Discover's loader; while another person's roles load
// in the page, a placeholder holds the strip's place, so the grid moves only when the strip turns out empty.
import { useSearchParams } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useContext,
	useMemo,
	useState,
} from "react"
import type { CharacterRole } from "~/domain/character-portraits"
import { useCharacterQuickView } from "~/ui/character-quick-view/context"
import { PortraitImg, TvdbCredit } from "~/ui/character-quick-view/parts"
import { roleEntry, usePersonRoles } from "~/ui/character-quick-view/portraits"
import { RowArrows, useStepRow } from "~/ui/row-arrows"

type Card = { media_type: string; tmdb_id: number }

interface Roles {
	personId: number
	name: string
	of: (card: Card) => CharacterRole | undefined
	ringed: string | null
	ring: (key: string) => void
}

const RolesContext = createContext<Roles | null>(null)

const cardKey = (card: Card) => `${card.media_type}-${card.tmdb_id}`

/** How long a card stays ringed after the strip pointed at it. */
const RING_MS = 1800

/**
 * Wraps Discover's results (the grid or the taste rows): the strip above them, and the ring around a card the strip
 * pointed at. `cards` are the results in screen order.
 */
export function DiscoverRoles({
	cards,
	children,
}: {
	cards: Card[]
	children: ReactNode
}) {
	const [params] = useSearchParams()
	const personId = Number((params.get("people") ?? "").split(",")[0]) || null
	const roles = usePersonRoles(personId)
	const [ringed, setRinged] = useState<string | null>(null)
	const value = useMemo<Roles | null>(() => {
		if (!personId || !roles.ready || !roles.list.length) return null
		return {
			personId,
			name: roles.name,
			of: (card) => roles.of(card.media_type, card.tmdb_id),
			ringed,
			ring: (key) => {
				setRinged(key)
				window.setTimeout(
					() => setRinged((k) => (k === key ? null : k)),
					RING_MS,
				)
			},
		}
	}, [personId, roles, ringed])
	return (
		<RolesContext.Provider value={value}>
			{value ? (
				<RolesStrip cards={cards} />
			) : (
				roles.loading && <RolesStripPlaceholder />
			)}
			{children}
		</RolesContext.Provider>
	)
}

/** Around one result card (in the grid or a row): the place the strip scrolls to, and its ring with "as …" over it while ringed. */
export function DiscoverCardRole({
	card,
	inset = false,
	children,
}: {
	card: Card
	/** In a row that scrolls sideways (which clips anything outside it): the ring drawn inside the card. */
	inset?: boolean
	children: ReactNode
}) {
	const ctx = useContext(RolesContext)
	const role = ctx?.of(card)
	if (!ctx || !role) return <>{children}</>
	const ringed = ctx.ringed === cardKey(card)
	return (
		<div
			data-role-card={cardKey(card)}
			className={`relative scroll-mt-40 rounded-lg transition-shadow duration-300 ${ringed && !inset ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-gray-950" : ""}`}
		>
			{inset ? (
				<div className="relative">
					{children}
					{ringed && (
						<span
							aria-hidden
							className="pointer-events-none absolute inset-0 z-10 rounded-lg ring-4 ring-amber-400 ring-inset"
						/>
					)}
				</div>
			) : (
				children
			)}
			{/* Over the card's top, never under it: a caption under the card would grow the row and move what follows. */}
			{ringed && (
				<p
					className="pointer-events-none absolute inset-x-1.5 top-1.5 z-20 truncate rounded-md bg-gray-950/85 px-2 py-1 text-xs font-medium text-amber-300"
					title={role.character}
				>
					as {role.character}
				</p>
			)}
		</div>
	)
}

/** The strip's classes, shared with its placeholder so both take the same room. */
const STRIP =
	"mb-5 w-full min-w-0 max-w-full overflow-hidden [contain:inline-size]"
const STRIP_ROW = "flex gap-2.5 overflow-hidden pb-2"
const TILE = "w-20 shrink-0 sm:w-24"
const TILE_PICTURE =
	"relative block aspect-[2/3] overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900"

/** The strip's room while a person's roles load: the same header, tiles and credit lines, empty. */
function RolesStripPlaceholder() {
	return (
		<div aria-hidden className={STRIP}>
			<div className="mb-2 flex h-5 items-center lg:h-8">
				<span className="h-4 w-56 max-w-full animate-pulse rounded bg-white/[0.04]" />
			</div>
			<div className={STRIP_ROW}>
				{Array.from({ length: 10 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
					<span key={i} className={TILE}>
						<span className={`${TILE_PICTURE} animate-pulse`} />
						<span className="mt-1 block text-xs">&nbsp;</span>
						<span className="block text-[0.6875rem]">&nbsp;</span>
					</span>
				))}
			</div>
			<p className="text-[11px]">&nbsp;</p>
		</div>
	)
}

function RolesStrip({ cards }: { cards: Card[] }) {
	const ctx = useContext(RolesContext)
	// A title in more than one taste row shows once, at its first place.
	const seen = new Set<string>()
	const shown = ctx
		? cards.flatMap((card) => {
				const role = ctx.of(card)
				if (!role || seen.has(cardKey(card))) return []
				seen.add(cardKey(card))
				return [{ card, role }]
			})
		: []
	const row = useStepRow<HTMLDivElement>([shown.length])
	const view = useCharacterQuickView()
	if (!ctx || !shown.length) return null
	const person = { id: ctx.personId, name: ctx.name }
	const go = (card: Card, role: CharacterRole, from: HTMLElement) => {
		const key = cardKey(card)
		// The first card of the title on the page (a title can sit in more than one taste row).
		const target = document.querySelector(`[data-role-card="${key}"]`)
		if (!target) {
			view?.open(
				roleEntry(role, person),
				from,
				shown.map((s) => roleEntry(s.role, person)),
			)
			return
		}
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		target.scrollIntoView({
			behavior: reduce ? "auto" : "smooth",
			block: "center",
			// A card in a row that scrolls sideways comes into that row's view too.
			inline: "nearest",
		})
		ctx.ring(key)
	}
	// contain: inline-size keeps the strip from widening the results column; it scrolls inside it instead. The head
	// keeps the arrows' height from the first paint, as the placeholder does, so they never push the grid down.
	return (
		<section
			className={STRIP}
			aria-label={`${ctx.name}'s characters in these results`}
		>
			<div className="mb-2 flex min-h-5 items-center gap-3 lg:min-h-8">
				<p className="min-w-0 flex-1 text-sm text-gray-400">
					<span className="font-semibold text-gray-200">{ctx.name}</span> plays{" "}
					{shown.length === 1 ? "one character" : `${shown.length} characters`}{" "}
					here
				</p>
				<RowArrows row={row} label="characters" />
			</div>
			<div
				ref={row.ref}
				onScroll={row.measure}
				className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{shown.map(({ card, role }) => (
					<button
						key={cardKey(card)}
						type="button"
						onClick={(e) => go(card, role, e.currentTarget)}
						className={`group ${TILE} cursor-pointer snap-start text-left`}
					>
						<span
							className={`${TILE_PICTURE} can-hover:group-hover:border-amber-700/50`}
						>
							<PortraitImg
								src={role.image}
								alt={`${ctx.name} as ${role.character}`}
								className="absolute inset-0 h-full w-full"
							/>
						</span>
						<span className="mt-1 block truncate text-xs font-semibold text-gray-200">
							{role.character}
						</span>
						<span className="block truncate text-[0.6875rem] text-gray-500">
							{role.title}
						</span>
					</button>
				))}
			</div>
			<TvdbCredit />
		</section>
	)
}
