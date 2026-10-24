// The picks. Every poster sits in a PickTap: a tap opens its detail.
// - phones (and tablets): the list starts with the strip: the top four big with titles, then six small, in one
//   12-column grid. An open drawer covers the page below those two rows, so closing it leaves the strip in place and
//   uncovers the rest: three across, then four across. Titles climbing from #7 to #2 slide and grow into place.
// - desktop: full-width rows with steps per width (big, medium, small, dense).
// - no counts or chips under posters: the why lives in the detail.
// Before hydration both layouts render (each hidden by CSS on the other screen size), so the first paint is right
// on every screen; after it only the matching one stays.
import { Link } from "@remix-run/react"
import { LayoutGroup, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { Ranked } from "~/domain/for-you-page/rank"
import { DISPLAY } from "~/ui/my-pages/bits"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { PickTap } from "./PickTap"
import { posterSrc, titleAt, toCard, useForYou } from "./context"

const SPRING = {
	type: "spring",
	stiffness: 400,
	damping: 36,
	mass: 0.8,
} as const

type Size = "phone" | "lg" | "xl"
const TIERS: Record<
	Exclude<Size, "phone">,
	{
		cut: [number, number, number]
		dense: number
		big: string
		medium: string
		small: string
		denseCols: string
	}
> = {
	lg: {
		cut: [4, 10, 18],
		dense: 10,
		big: "grid-cols-4",
		medium: "grid-cols-6",
		small: "grid-cols-8",
		denseCols: "grid-cols-10",
	},
	xl: {
		cut: [5, 12, 22],
		dense: 12,
		big: "grid-cols-5",
		medium: "grid-cols-7",
		small: "grid-cols-10",
		denseCols: "grid-cols-12",
	},
}

/** The screen size, or null before hydration. */
function useSize(): Size | null {
	const [size, setSize] = useState<Size | null>(null)
	useEffect(() => {
		const lg = window.matchMedia("(min-width: 1024px)")
		const xl = window.matchMedia("(min-width: 1280px)")
		const on = () => setSize(xl.matches ? "xl" : lg.matches ? "lg" : "phone")
		on()
		lg.addEventListener("change", on)
		xl.addEventListener("change", on)
		return () => {
			lg.removeEventListener("change", on)
			xl.removeEventListener("change", on)
		}
	}, [])
	return size
}

/** The strip's shape: four big with titles, six small. */
export const STRIP_BIG = 4
export const STRIP_ALL = 10

/** True from the first effect on: items that mount later fade in, the first render doesn't. */
function useMounted() {
	const mounted = useRef(false)
	useEffect(() => {
		mounted.current = true
	}, [])
	return mounted
}

export function Results({ title }: { title: React.ReactNode }) {
	const size = useSize()
	const mounted = useMounted()
	return (
		<LayoutGroup id="results">
			{size !== "lg" && size !== "xl" && (
				<div className={size ? "" : "lg:hidden"}>
					<PhoneList title={title} mounted={mounted} />
				</div>
			)}
			{size !== "phone" && (
				<div className={size ? "" : "max-lg:hidden"}>
					<DeskList
						title={title}
						size={size ?? "xl"}
						mounted={mounted}
						eager={size !== null}
					/>
				</div>
			)}
		</LayoutGroup>
	)
}

type Mounted = React.MutableRefObject<boolean>

function PhoneList({
	title,
	mounted,
}: { title: React.ReactNode; mounted: Mounted }) {
	const { ranked, pool } = useForYou()
	const [more, setMore] = useState(0)
	const top = ranked.slice(0, STRIP_ALL)
	const three = ranked.slice(STRIP_ALL, STRIP_ALL + 9)
	const fourEnd = STRIP_ALL + 9 + 20 * (more + 1)
	const four = ranked.slice(STRIP_ALL + 9, fourEnd)
	return (
		<div className="mx-auto max-w-xl">
			<div className="flex h-8 items-center">
				<h2
					className={`${DISPLAY} min-w-0 flex-1 truncate text-[15px] leading-5 text-white`}
				>
					{title}
				</h2>
			</div>
			<div className="grid grid-cols-12 gap-2">
				{top.map((r, i) => {
					const big = i < STRIP_BIG
					const t = titleAt(pool, r.index)
					return (
						<motion.div
							key={t.key}
							layout
							layoutId={`phone-${t.key}`}
							initial={mounted.current ? { opacity: 0, scale: 0.9 } : false}
							animate={{ opacity: 1, scale: 1 }}
							transition={SPRING}
							className={`relative min-w-0 ${big ? "col-span-3" : "col-span-2"}`}
							data-rank={i}
							data-strip-row={big ? 1 : 2}
						>
							<PickTap r={r}>
								<motion.div
									layout
									transition={SPRING}
									className={`relative aspect-[2/3] overflow-hidden bg-gray-800 ring-1 ring-white/10 ${big ? "rounded-lg" : "rounded-md"}`}
								>
									<Link to={t.href} className="absolute inset-0">
										{t.poster && (
											<img
												src={posterSrc(t.poster, "w185")}
												alt={t.name}
												draggable={false}
												className="size-full object-cover"
											/>
										)}
									</Link>
									<span className="pointer-events-none absolute top-1 left-1 rounded-md bg-gray-950/85 px-1 text-[10px] leading-4 font-black text-white tabular-nums">
										{i + 1}
									</span>
								</motion.div>
							</PickTap>
							{big && (
								<motion.p
									layout="position"
									transition={SPRING}
									className="mt-1 line-clamp-2 h-[26px] text-[11px] leading-[13px] font-semibold text-gray-100"
								>
									{t.name}
								</motion.p>
							)}
						</motion.div>
					)
				})}
			</div>
			{three.length > 0 && (
				<div className="mt-3 grid grid-cols-3 gap-2.5">
					{three.map((r, i) => (
						<Item
							key={r.index}
							r={r}
							at={STRIP_ALL + i}
							prefix="phone"
							mounted={mounted}
						>
							<PickTap r={r}>
								<SmallPoster r={r} />
							</PickTap>
						</Item>
					))}
				</div>
			)}
			{four.length > 0 && (
				<div className="mt-2.5 grid grid-cols-4 gap-2">
					{four.map((r, i) => (
						<Item
							key={r.index}
							r={r}
							at={STRIP_ALL + 9 + i}
							prefix="phone"
							mounted={mounted}
						>
							<PickTap r={r}>
								<SmallPoster r={r} />
							</PickTap>
						</Item>
					))}
				</div>
			)}
			{fourEnd < ranked.length && (
				<button
					type="button"
					onClick={() => setMore(more + 1)}
					className="mx-auto mt-6 block min-h-11 rounded-full px-5 text-sm font-semibold text-gray-300 ring-1 ring-white/15 hover:bg-white/5 hover:text-white"
				>
					Show more
				</button>
			)}
		</div>
	)
}

function DeskList({
	title,
	size,
	mounted,
	eager,
}: {
	title: React.ReactNode
	size: Exclude<Size, "phone">
	mounted: Mounted
	/** The top row loads eagerly once the layout is known (not while phones may still hide it). */
	eager: boolean
}) {
	const { ranked, pool } = useForYou()
	const [more, setMore] = useState(0)
	const t = TIERS[size]
	const [c0, c1, c2] = t.cut
	const big = ranked.slice(0, c0)
	const medium = ranked.slice(c0, c1)
	const small = ranked.slice(c1, c2)
	const denseCount = t.dense * 4 * (more + 1)
	const dense = ranked.slice(c2, c2 + denseCount)
	const item = (r: Ranked, at: number, child: React.ReactNode) => (
		<Item key={r.index} r={r} at={at} prefix="desk" mounted={mounted}>
			<PickTap r={r}>{child}</PickTap>
		</Item>
	)
	return (
		<>
			<h2 className={`${DISPLAY} mb-4 truncate text-2xl text-white`}>
				{title}
			</h2>
			<div className={`grid gap-5 ${t.big}`}>
				{big.map((r, i) =>
					item(
						r,
						i,
						<TitlePosterCard
							card={toCard(pool, r)}
							actions={false}
							posterPriority={eager ? "eager" : undefined}
						/>,
					),
				)}
			</div>
			<div className={`mt-8 grid gap-3 ${t.medium}`}>
				{medium.map((r, i) =>
					item(
						r,
						c0 + i,
						<TitlePosterCard card={toCard(pool, r)} actions={false} />,
					),
				)}
			</div>
			<div className={`mt-8 grid gap-2.5 ${t.small}`}>
				{small.map((r, i) => item(r, c1 + i, <SmallPoster r={r} />))}
			</div>
			{dense.length > 0 && (
				<div className={`mt-8 grid gap-2 ${t.denseCols}`}>
					{dense.map((r, i) => item(r, c2 + i, <SmallPoster r={r} dense />))}
				</div>
			)}
			{c2 + denseCount < ranked.length && (
				<button
					type="button"
					onClick={() => setMore(more + 1)}
					className="mx-auto mt-6 block min-h-11 rounded-full px-5 text-sm font-semibold text-gray-300 ring-1 ring-white/15 hover:bg-white/5 hover:text-white"
				>
					Show more
				</button>
			)}
		</>
	)
}

function Item({
	r,
	at,
	prefix,
	mounted,
	children,
}: {
	r: Ranked
	at: number
	prefix: string
	mounted: Mounted
	children: React.ReactNode
}) {
	const { pool } = useForYou()
	return (
		<motion.div
			layout="position"
			layoutId={`${prefix}-${pool.keys[r.index]}`}
			data-rank={at}
			initial={mounted.current ? { opacity: 0, scale: 0.94 } : false}
			animate={{ opacity: 1, scale: 1 }}
			transition={SPRING}
			className="relative min-w-0"
		>
			{children}
		</motion.div>
	)
}

function SmallPoster({ r, dense = false }: { r: Ranked; dense?: boolean }) {
	const { pool } = useForYou()
	const t = titleAt(pool, r.index)
	return (
		<Link
			to={t.href}
			className="group relative block overflow-hidden rounded-lg bg-gray-800 ring-1 ring-white/10"
			title={`${t.name}${t.year ? ` (${t.year})` : ""}`}
		>
			{t.poster ? (
				<img
					src={posterSrc(t.poster, dense ? "w154" : "w185")}
					alt={t.name}
					loading="lazy"
					className="aspect-[2/3] w-full object-cover transition-transform group-hover:scale-[1.03]"
				/>
			) : (
				<div className="aspect-[2/3] w-full" aria-label={t.name} />
			)}
		</Link>
	)
}
