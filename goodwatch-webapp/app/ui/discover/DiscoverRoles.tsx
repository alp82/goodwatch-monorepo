// Discover with a cast filter on (?people=<id>; the first person counts): above the grid, a strip of the characters
// that person plays among the results, TheTVDB's portraits with arrows on a wide screen. A press scrolls to that title's
// card and rings it for a moment, with "as Walter White" under it. Without a cast filter, or without portraits among
// the results, nothing shows.
import { useSearchParams } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useContext,
	useMemo,
	useState,
} from "react"
import type { CharacterRole } from "~/domain/character-portraits"
import { PortraitImg, TvdbCredit } from "~/ui/character-quick-view/parts"
import { usePersonRoles } from "~/ui/character-quick-view/portraits"
import { RowArrows, useStepRow } from "~/ui/row-arrows"

type Card = { media_type: string; tmdb_id: number }

interface Roles {
	name: string
	of: (card: Card) => CharacterRole | undefined
	ringed: string | null
	ring: (key: string) => void
}

const RolesContext = createContext<Roles | null>(null)

const cardKey = (card: Card) => `${card.media_type}-${card.tmdb_id}`

/** How long a card stays ringed after the strip pointed at it. */
const RING_MS = 1800

/** Wraps Discover's grid: the strip above it, and the ring around a card the strip pointed at. */
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
			{value && <RolesStrip cards={cards} />}
			{children}
		</RolesContext.Provider>
	)
}

/** Around one grid card: the place the strip scrolls to, and its ring with "as …" while ringed. */
export function DiscoverCardRole({
	card,
	children,
}: {
	card: Card
	children: ReactNode
}) {
	const ctx = useContext(RolesContext)
	const role = ctx?.of(card)
	if (!ctx || !role) return <>{children}</>
	const ringed = ctx.ringed === cardKey(card)
	return (
		<div
			data-role-card={cardKey(card)}
			className={`relative scroll-mt-40 rounded-lg transition-shadow duration-300 ${ringed ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-gray-950" : ""}`}
		>
			{children}
			{ringed && (
				<p
					className="mt-1 truncate px-1 text-xs text-gray-400"
					title={role.character}
				>
					as {role.character}
				</p>
			)}
		</div>
	)
}

function RolesStrip({ cards }: { cards: Card[] }) {
	const ctx = useContext(RolesContext)
	const shown = ctx
		? cards.flatMap((card) => {
				const role = ctx.of(card)
				return role ? [{ card, role }] : []
			})
		: []
	const row = useStepRow<HTMLDivElement>([shown.length])
	if (!ctx || !shown.length) return null
	const go = (card: Card) => {
		const key = cardKey(card)
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		document
			.querySelector(`[data-role-card="${key}"]`)
			?.scrollIntoView({
				behavior: reduce ? "auto" : "smooth",
				block: "center",
			})
		ctx.ring(key)
	}
	// contain: inline-size keeps the strip from widening the results column; it scrolls inside it instead.
	return (
		<section
			className="mb-5 w-full min-w-0 max-w-full overflow-hidden [contain:inline-size]"
			aria-label={`${ctx.name}'s characters in these results`}
		>
			<div className="mb-2 flex items-center gap-3">
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
						onClick={() => go(card)}
						className="group w-20 shrink-0 cursor-pointer snap-start text-left sm:w-24"
					>
						<span className="relative block aspect-[2/3] overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900 can-hover:group-hover:border-amber-700/50">
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
