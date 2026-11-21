// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). The page title IS the blend: a headline that reads
// as a phrase ("Cozy comedies from the 1990s on Netflix") in which every ingredient is a token.
//   - A token carries its family's form: a mood is underlined in its hue, a service brings its logo, the rest get a
//     quiet underline. Click it to swap it for a sibling or take it out; hover shows a one-click remove.
//   - "Add" opens the pantry. Nothing is ever replaced by adding.
//   - An ingredient dragged from a card can be dropped on the headline; a token dragged out of it is taken out.
// When the address changes, the words glide to their new places and the new token lands with a small burst
// (transform and opacity only).
import { Link, useNavigate } from "@remix-run/react"
import { CheckBadgeIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { type DragEvent, type ReactNode, forwardRef, useEffect, useRef, useState } from "react"
import {
	type Address,
	type Kind,
	add,
	best as bestAddress,
	hub,
	place,
	remove,
	swap,
} from "../../kit/address"
import type { PlaceRef } from "../../kit/types"
import { PlaceMark, SPRING, poster } from "../../kit/ui"
import { Floating } from "./Floating"
import type { PantryGroup } from "./loader.server"
import { Pantry } from "./Pantry"
import { BEST_COLOR, DRAG_TYPE, NEUTRAL, colorOf, idOf, nice, useDrag } from "./parts"
import { FAMILY_WORD, type Seg, phrase } from "./phrase"

type To = (a: Address, extra?: Record<string, string | undefined>) => string

const REMOVE =
	"absolute -top-[0.3em] -right-[0.42em] z-10 grid h-6 w-6 scale-75 place-items-center rounded-full bg-gray-800 text-gray-200 opacity-0 shadow-md ring-1 ring-white/25 outline-none transition-[opacity,transform,background-color,color] duration-150 group-hover/token:scale-100 group-hover/token:opacity-100 hover:bg-white hover:text-gray-950 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400 [@media(hover:none)]:hidden"
const MENU_LINK =
	"flex min-h-9 items-center gap-2 rounded-lg px-2 text-[15px] font-semibold text-gray-200 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"

/** The burst behind a token that just landed. */
function Landing({ color }: { color: string }) {
	return (
		<motion.span
			aria-hidden
			className="pointer-events-none absolute inset-0 -z-10 rounded-full"
			style={{ background: color === NEUTRAL ? "#ffffff" : color }}
			initial={{ opacity: 0.55, scale: 0.6 }}
			animate={{ opacity: 0, scale: 1.7 }}
			transition={{ duration: 0.7, ease: "easeOut" }}
		/>
	)
}

const TokenShell = forwardRef<
	HTMLSpanElement,
	{
		id: string
		color: string
		fresh: boolean
		ghost?: boolean
		children: ReactNode
	}
>(function TokenShell({ id, color, fresh, ghost, children }, ref) {
	const reduce = useReducedMotion()
	return (
		<motion.span
			ref={ref}
			key={id}
			layout={reduce ? false : "position"}
			initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 10 }}
			animate={{ opacity: ghost ? 0.55 : 1, scale: 1, y: 0 }}
			exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -8 }}
			transition={SPRING}
			className="group/token relative inline-flex"
		>
			{fresh && !reduce && <Landing color={color} />}
			{children}{" "}
		</motion.span>
	)
})

/** The underline that marks a word as an ingredient. */
const Bar = ({ color, dashed }: { color: string; dashed?: boolean }) => (
	<span
		aria-hidden
		className="absolute inset-x-0 -bottom-[0.05em] h-[0.085em] rounded-full"
		style={
			dashed
				? {
						backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 0.3em, transparent 0.3em 0.5em)`,
					}
				: { background: color }
		}
	/>
)

const TOKEN =
	"relative -mx-[0.12em] inline-flex cursor-pointer items-center gap-[0.22em] rounded-[0.24em] px-[0.12em] outline-none transition-colors duration-150 hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-amber-400 aria-expanded:bg-white/[0.12]"

export function BlendBar({
	kind,
	address,
	parts,
	isBest = false,
	year,
	years = [],
	shorts,
	swaps,
	pantry,
	to,
	adds = true,
}: {
	/** False: no "Add" button and no pantry here (a page that lays the pantry out itself). */
	adds?: boolean
	kind: Kind
	address: Address
	parts: PlaceRef[]
	isBest?: boolean
	year?: number | null
	/** Best: the release years offered in the year token's menu. */
	years?: number[]
	/** Each ingredient's one-line description, by "family:slug". */
	shorts: Record<string, string>
	swaps: { part: PlaceRef; options: PlaceRef[] }[]
	pantry: PantryGroup[]
	to: To
}) {
	const navigate = useNavigate()
	const reduce = useReducedMotion()
	const { dragged, set: setDragged } = useDrag()
	const [menu, setMenu] = useState<string | null>(null)
	const [over, setOver] = useState(false)
	const [pulling, setPulling] = useState<string | null>(null)
	const anchors = useRef(new Map<string, HTMLElement>())
	const anchor = useRef<HTMLElement>(null) as { current: HTMLElement | null }
	const wrap = useRef<HTMLDivElement>(null)
	const addButton = useRef<HTMLButtonElement>(null)

	// Tokens that were not on the previous page land with a burst.
	const before = useRef<Set<string> | null>(null)
	const now = new Set([...parts.map(idOf), ...(isBest ? ["best"] : []), ...(year ? ["year"] : [])])
	const fresh = (id: string) => before.current !== null && !before.current.has(id)
	useEffect(() => {
		before.current = now
	})

	const taken = (p: PlaceRef) => parts.some((x) => idOf(x) === idOf(p))
	const ghost = over && dragged && !taken(dragged) ? dragged : null
	const segs = phrase(kind, ghost ? [...parts, ghost] : parts, {
		best: isBest,
		year: year ?? undefined,
	})
	const many = segs.length > 7

	const open = (id: string) => {
		anchor.current = anchors.current.get(id) ?? null
		setMenu((m) => (m === id ? null : id))
	}
	const closeMenu = () => setMenu(null)
	const without = (p: PlaceRef) => to(remove(address, p))
	const noBest = parts.length ? place(kind, address.parts, address.country) : hub(kind)

	const canDrop = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE)
	const onDrop = (e: DragEvent) => {
		if (!canDrop(e)) return
		e.preventDefault()
		setOver(false)
		const p = dragged
		setDragged(null)
		if (p && !taken(p)) navigate(to(add(address, p)), { preventScrollReset: true })
	}

	const words = segs.map((s, i) => {
		if (s.t === "text") {
			const nth = segs.slice(0, i).filter((x) => x.t === "text" && x.text === s.text).length
			return (
				<motion.span
					key={`w:${s.text.toLowerCase()}:${nth}`}
					layout={reduce ? false : "position"}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={SPRING}
					className="inline-block"
				>
					{s.text}{" "}
				</motion.span>
			)
		}
		if (s.t === "best")
			return (
				<TokenShell key="best" id="best" color={BEST_COLOR} fresh={fresh("best")}>
					<button
						type="button"
						ref={(el) => {
							if (el) anchors.current.set("best", el)
						}}
						aria-haspopup="dialog"
						aria-expanded={menu === "best"}
						onClick={() => open("best")}
						className={TOKEN}
					>
						<CheckBadgeIcon aria-hidden className="h-[0.62em] w-[0.62em] text-amber-400" />
						<span className="relative">
							{s.text}
							<Bar color={BEST_COLOR} />
						</span>
					</button>
					<Link
						to={to(noBest)}
						preventScrollReset
						aria-label="Stop ranking by the best"
						className={REMOVE}
					>
						<XMarkIcon className="h-3.5 w-3.5" />
					</Link>
				</TokenShell>
			)
		if (s.t === "year")
			return (
				<TokenShell key="year" id="year" color={NEUTRAL} fresh={fresh("year")}>
					<button
						type="button"
						ref={(el) => {
							if (el) anchors.current.set("year", el)
						}}
						aria-haspopup="dialog"
						aria-expanded={menu === "year"}
						onClick={() => open("year")}
						className={TOKEN}
					>
						<span className="relative tabular-nums">
							{s.text}
							<Bar color={NEUTRAL} />
						</span>
					</button>
					<Link
						to={to({ ...address, year: undefined, page: undefined })}
						preventScrollReset
						aria-label={`Any year, not only ${s.year}`}
						className={REMOVE}
					>
						<XMarkIcon className="h-3.5 w-3.5" />
					</Link>
				</TokenShell>
			)
		const id = idOf(s.part)
		const isGhost = !!ghost && idOf(ghost) === id
		const color = colorOf(s.part)
		return (
			<TokenShell key={id} id={id} color={color} fresh={fresh(id) && !isGhost} ghost={isGhost}>
				<button
					type="button"
					ref={(el) => {
						if (el) anchors.current.set(id, el)
					}}
					aria-haspopup="dialog"
					aria-expanded={menu === id}
					aria-label={`${s.part.label}, ${FAMILY_WORD[
						s.part.family
					].toLowerCase()}: swap or take out`}
					onClick={() => !isGhost && open(id)}
					draggable={!isGhost}
					onDragStart={(e) => {
						e.dataTransfer.setData("text/plain", s.part.label)
						e.dataTransfer.effectAllowed = "move"
						setPulling(id)
					}}
					onDragEnd={(e) => {
						setPulling(null)
						const r = wrap.current?.getBoundingClientRect()
						if (!r || (e.clientX === 0 && e.clientY === 0)) return
						const out =
							e.clientX < r.left - 30 ||
							e.clientX > r.right + 30 ||
							e.clientY < r.top - 30 ||
							e.clientY > r.bottom + 30
						if (out) navigate(without(s.part), { preventScrollReset: true })
					}}
					className={TOKEN}
				>
					{s.part.family === "service" && s.part.logo && (
						<img
							src={poster(s.part.logo, "w92")}
							alt=""
							className="h-[0.78em] w-[0.78em] rounded-[22%] ring-1 ring-white/15"
						/>
					)}
					<span className={`relative ${s.part.family === "decade" ? "tabular-nums" : ""}`}>
						{s.text}
						<Bar color={color} dashed={isGhost} />
					</span>
				</button>
				{!isGhost && (
					<Link
						to={without(s.part)}
						preventScrollReset
						aria-label={`Take out ${s.part.label}`}
						className={REMOVE}
					>
						<XMarkIcon className="h-3.5 w-3.5" />
					</Link>
				)}
			</TokenShell>
		)
	})

	const current = parts.find((p) => idOf(p) === menu)
	const options = current ? (swaps.find((x) => idOf(x.part) === menu)?.options ?? []) : []
	const armed = !!dragged && !taken(dragged)
	return (
		<div
			ref={wrap}
			onDragOver={(e) => {
				if (!canDrop(e)) return
				e.preventDefault()
				e.dataTransfer.dropEffect = "copy"
				if (!over) setOver(true)
			}}
			onDragLeave={(e) => {
				if (!wrap.current?.contains(e.relatedTarget as Node)) setOver(false)
			}}
			onDrop={onDrop}
			className="relative"
		>
			<span
				aria-hidden
				className={`pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-2xl border-2 border-dashed transition-opacity duration-200 ${
					over
						? "border-white/60 bg-white/[0.05] opacity-100"
						: armed
							? "border-white/25 opacity-100"
							: "border-transparent opacity-0"
				}`}
			/>
			<div
				className={`relative flex flex-wrap items-center gap-x-[0.27em] gap-y-[0.18em] font-display leading-[1.16] font-bold tracking-tight text-white ${
					many
						? "text-[2rem] sm:text-[2.6rem] lg:text-5xl"
						: "text-[2.25rem] sm:text-5xl lg:text-[3.5rem]"
				}`}
			>
				<LayoutGroup>
					<h1 className="contents" aria-label={segs.map((x) => x.text).join(" ")}>
						<AnimatePresence initial={false} mode="popLayout">
							{words}
						</AnimatePresence>
					</h1>
					<motion.span
						layout={reduce ? false : "position"}
						transition={SPRING}
						className={adds ? "ml-[0.1em] inline-flex" : "hidden"}
					>
						<button
							ref={addButton}
							type="button"
							aria-haspopup="dialog"
							aria-expanded={menu === "add"}
							onClick={() => {
								anchor.current = addButton.current
								setMenu((m) => (m === "add" ? null : "add"))
							}}
							className="inline-flex h-10 items-center gap-1 rounded-full bg-white/[0.07] pr-4 pl-2.5 font-sans text-base font-bold tracking-normal text-gray-100 ring-1 ring-white/20 outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-white/[0.14] hover:ring-white/45 focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.97] aria-expanded:bg-white aria-expanded:text-gray-950"
						>
							<PlusIcon className="h-5 w-5" />
							Add
						</button>
					</motion.span>
				</LayoutGroup>
			</div>
			<p
				aria-hidden={!armed && !pulling}
				className={`pointer-events-none absolute -top-5 right-2 rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-white shadow-lg ring-1 ring-white/30 transition-opacity duration-200 ${armed || pulling ? "opacity-100" : "opacity-0"}`}
			>
				{pulling
					? "Drop it off the title to take it out"
					: over
						? "Let go to add it"
						: "Drop it here to add it"}
			</p>

			<Floating
				open={menu === "add"}
				onClose={closeMenu}
				anchor={anchor as never}
				alignTo={wrap}
				width={940}
				label="Add an ingredient"
			>
				<Pantry
					kind={kind}
					address={address}
					parts={parts}
					isBest={isBest}
					year={year}
					groups={pantry}
					to={to}
				/>
			</Floating>

			<Floating
				open={!!current}
				onClose={closeMenu}
				anchor={anchor as never}
				width={options.length > 16 ? 540 : 380}
				label={current ? `${current.label}: swap or take out` : "Ingredient"}
			>
				{current && (
					<div className="p-3">
						<div className="flex items-start gap-3 px-2 pt-1">
							<div className="min-w-0 flex-1">
								<p className="text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
									{FAMILY_WORD[current.family]}
								</p>
								<p className="mt-0.5 flex items-center gap-2 font-display text-xl font-bold text-white">
									<PlaceMark place={current} size={17} />
									{nice(current)}
								</p>
								{shorts[idOf(current)] && (
									<p className="mt-0.5 text-sm leading-snug text-gray-400">
										{shorts[idOf(current)]}
									</p>
								)}
							</div>
							<Link
								to={without(current)}
								preventScrollReset
								className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white/[0.07] pr-3.5 pl-2.5 text-sm font-bold text-gray-100 ring-1 ring-white/15 outline-none transition-colors hover:bg-white hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<XMarkIcon className="h-4 w-4" />
								Take out
							</Link>
						</div>
						{options.length > 0 && (
							<>
								<p className="mt-4 px-2 text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
									Swap it for
								</p>
								<div
									className={`mt-1 grid max-h-[40vh] gap-x-2 gap-y-0.5 overflow-y-auto sm:max-h-[19rem] ${
										options.length > 12 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
									}`}
								>
									{options.map((o) => (
										<Link
											key={o.slug}
											to={to(swap(address, current, o))}
											preventScrollReset
											prefetch="intent"
											className={MENU_LINK}
										>
											<PlaceMark place={o} size={15} />
											<span className="leading-tight">{nice(o)}</span>
										</Link>
									))}
								</div>
							</>
						)}
						{parts.length > 1 && (
							<Link
								to={to(place(kind, [current], address.country))}
								prefetch="intent"
								className="mt-3 flex items-center justify-between border-t border-white/10 px-2 pt-3 text-sm font-semibold text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span>Just {nice(current)}, nothing else</span>
								<span aria-hidden>→</span>
							</Link>
						)}
					</div>
				)}
			</Floating>

			<Floating
				open={menu === "best"}
				onClose={closeMenu}
				anchor={anchor as never}
				width={320}
				label="Best"
			>
				<div className="p-4">
					<p className="flex items-center gap-2 font-display text-xl font-bold text-white">
						<CheckBadgeIcon className="h-5 w-5 text-amber-400" />
						Best
					</p>
					<p className="mt-1 text-sm leading-snug text-gray-400">
						Only the highest rated, in order, with what each source gave them.
					</p>
					<Link
						to={to(noBest)}
						preventScrollReset
						className="mt-3 flex h-9 w-fit items-center gap-1 rounded-full bg-white/[0.07] pr-3.5 pl-2.5 text-sm font-bold text-gray-100 ring-1 ring-white/15 outline-none transition-colors hover:bg-white hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" />
						Show them all, unranked
					</Link>
				</div>
			</Floating>

			<Floating
				open={menu === "year"}
				onClose={closeMenu}
				anchor={anchor as never}
				width={300}
				label="Release year"
			>
				<div className="p-3">
					<p className="px-2 pt-1 text-[11px] font-semibold tracking-[0.14em] text-gray-500 uppercase">
						Another year
					</p>
					<div className="mt-1 grid grid-cols-3 gap-0.5">
						{years
							.filter((y) => y !== year)
							.map((y) => (
								<Link
									key={y}
									to={to({ ...bestAddress(kind, address.parts, y) })}
									preventScrollReset
									className={`${MENU_LINK} justify-center tabular-nums`}
								>
									{y}
								</Link>
							))}
					</div>
					<Link
						to={to({ ...address, year: undefined, page: undefined })}
						preventScrollReset
						className={`${MENU_LINK} mt-1 border-t border-white/10 pt-1`}
					>
						<XMarkIcon className="h-4 w-4 text-gray-400" />
						Any year
					</Link>
				</div>
			</Floating>
		</div>
	)
}

export type { Seg }
