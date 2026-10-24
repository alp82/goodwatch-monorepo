// Phones: the taste bar. With no drawer open it sits above the site's bottom nav; with one open it slides over the
// nav as the drawer's footer. Its small print opens the print drawer, the picked recipe opens the recipe drawer, and
// tapping the active one again closes it. Also the dice, the Reset icon and the live pill, shared with the page.
import { motion } from "framer-motion"
import { forwardRef, useEffect, useRef, useState } from "react"
import type { DecodedPool, FamilyId } from "~/domain/for-you-page/contract"
import type { Ranked } from "~/domain/for-you-page/rank"
import type { Level, Levels, Recipe } from "~/domain/for-you-page/shape"
import { DISPLAY } from "~/ui/my-pages/bits"
import { HandlePrint } from "./HandlePrint"
import { posterSrc } from "./context"

export type Sheet = "recipes" | "print" | null

export const SPRING = { type: "spring", stiffness: 420, damping: 36 } as const

export const TasteBar = forwardRef<
	HTMLDivElement,
	{
		pool: DecodedPool
		sheet: Sheet
		onOpen: (s: Exclude<Sheet, null>) => void
		levels: Levels
		tile: Recipe | undefined
		onSet: (f: FamilyId, l: Level) => void
		/** The two posters on the recipe button: the recipe's own top picks, or the current top two. */
		posters: (Ranked | undefined)[]
		subline: string
		rolls: number
		onRoll: () => void
		/** How far above the screen's bottom the bar sits while closed (the nav's height). */
		lift: number
		/** Above the nav's layer (while open, and until it has slid back). */
		onTop: boolean
		onSettled: () => void
		safeRef: React.RefObject<HTMLDivElement>
		transition: object
	}
>(function TasteBar(
	{
		pool,
		sheet,
		onOpen,
		levels,
		tile,
		onSet,
		posters,
		subline,
		rolls,
		onRoll,
		lift,
		onTop,
		onSettled,
		safeRef,
		transition,
	},
	ref,
) {
	const open = sheet !== null
	const liveMini = useRef<HTMLSpanElement>(null)
	return (
		<motion.div
			ref={ref}
			initial={false}
			animate={{ y: open ? 0 : -lift }}
			transition={transition}
			onAnimationComplete={onSettled}
			className={`fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-white/20 bg-[#1a2130] shadow-[0_-12px_32px_-8px_rgba(0,0,0,.95)] lg:hidden ${
				onTop ? "z-[1110]" : "z-40"
			}`}
			data-taste-bar={open ? "open" : "closed"}
		>
			<LivePill r={liveMini} className="bottom-full mb-2" />
			<div className="flex items-center gap-2 py-2 pr-2 pl-1.5">
				<div className="relative shrink-0 rounded-2xl p-0.5">
					<ActiveMark on={sheet === "print"} />
					<HandlePrint
						mini
						levels={levels}
						shape={tile ? tile.shape : null}
						onSet={onSet}
						onTap={() => onOpen("print")}
						liveRef={liveMini}
						className="size-[4.9rem]"
						label="Your taste print, small. Drag a handle for more or less of a family; tap to open it big, tap again to close."
					/>
				</div>
				<button
					type="button"
					onClick={() => onOpen("recipes")}
					aria-label={`Mood: ${tile?.name ?? "just your taste"}. ${sheet === "recipes" ? "Close moods" : "Change mood"}`}
					aria-pressed={sheet === "recipes"}
					className="relative flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-white/[0.05] py-1.5 pr-2.5 pl-2 text-left ring-1 ring-white/12 active:bg-white/[0.09]"
					data-recipe-button=""
				>
					<ActiveMark on={sheet === "recipes"} />
					<span
						className="relative h-12 w-[3.4rem] shrink-0"
						aria-hidden="true"
					>
						{[1, 0].map((k) => {
							const r = posters[k]
							const path = r ? pool.posters[r.index] : ""
							return (
								<span
									key={k}
									className="absolute top-0 h-12 w-[2rem] overflow-hidden rounded-md bg-gray-800 ring-2 ring-[#1a2130]"
									style={{
										left: k * 18,
										transform: `rotate(${k ? 7 : -4}deg)`,
										boxShadow: `0 0 0 3.5px ${tile?.hue ?? "#fbbf24"}55`,
									}}
								>
									{path && (
										<img
											src={posterSrc(path, "w92")}
											alt=""
											className="size-full object-cover"
										/>
									)}
								</span>
							)
						})}
					</span>
					<span className="relative min-w-0 flex-1">
						<motion.span
							key={tile?.id ?? "-"}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25 }}
							className={`${DISPLAY} block truncate text-[16px] leading-[1.35rem] text-white`}
						>
							{tile?.name ?? "Just your taste"}
						</motion.span>
						<motion.span
							key={subline}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.35 }}
							className="block truncate text-[12px] leading-4 text-gray-400"
						>
							{subline}
						</motion.span>
					</span>
					<motion.svg
						viewBox="0 0 20 20"
						className="size-5 shrink-0 text-amber-400"
						aria-hidden="true"
						initial={false}
						animate={{ rotate: open ? 180 : 0 }}
						transition={SPRING}
					>
						<path
							d="M5 12.5 10 7.5l5 5"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</motion.svg>
				</button>
				<Dice rolls={rolls} onRoll={onRoll} />
			</div>
			{/* The phone's home-indicator room: hidden behind the nav while closed, the bar's own floor while open. */}
			<div ref={safeRef} className="h-[env(safe-area-inset-bottom)]" />
		</motion.div>
	)
})

/** The bar's active item: a soft amber pill behind it and a short bar under it (fades, nothing moves). */
function ActiveMark({ on }: { on: boolean }) {
	return (
		<span
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-400/[0.11] ring-1 ring-amber-400/55 transition-opacity duration-200"
			style={{ opacity: on ? 1 : 0 }}
		>
			<span className="absolute bottom-[-5px] left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-amber-400" />
		</span>
	)
}

/** "Humor: lots more" while a handle is dragged; the print writes into it directly. */
export function LivePill({
	r,
	className,
}: { r: React.RefObject<HTMLSpanElement>; className: string }) {
	return (
		<span
			ref={r}
			aria-live="polite"
			className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-sm font-black whitespace-nowrap text-gray-950 opacity-0 transition-opacity ${className}`}
		/>
	)
}

/** Pip spots per face on a 24-unit die. Never one pip: it doesn't read as a dice. */
const PIPS: Record<number, [number, number][]> = {
	2: [
		[8, 8],
		[16, 16],
	],
	3: [
		[7.5, 7.5],
		[12, 12],
		[16.5, 16.5],
	],
	4: [
		[8, 8],
		[16, 8],
		[8, 16],
		[16, 16],
	],
	5: [
		[7.5, 7.5],
		[16.5, 7.5],
		[12, 12],
		[7.5, 16.5],
		[16.5, 16.5],
	],
	6: [
		[8, 7],
		[16, 7],
		[8, 12],
		[16, 12],
		[8, 17],
		[16, 17],
	],
}

/** Reset as a quiet icon in the dice's rounded rectangle, gone while there is nothing to reset. */
export function ResetIcon({
	on,
	onClick,
	className = "",
}: { on: boolean; onClick: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!on}
			aria-label="Reset to your taste"
			title="Reset"
			className={`grid size-11 place-items-center rounded-xl text-gray-400 ring-1 ring-white/10 transition-opacity duration-200 hover:text-white hover:ring-white/30 ${on ? "" : "pointer-events-none opacity-0"} ${className}`}
			data-reset=""
		>
			<svg viewBox="0 0 20 20" className="size-[1.1rem]" aria-hidden="true">
				<path
					d="M4.5 9.5a5.5 5.5 0 1 1 1.6 4.4M4.5 9.5V5.2M4.5 9.5h4.2"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.9"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	)
}

/** The dice: a random face 2-6 per roll, never the same twice in a row. */
export function Dice({
	rolls,
	onRoll,
	small = false,
}: { rolls: number; onRoll: () => void; small?: boolean }) {
	const [face, setFace] = useState(5)
	const seen = useRef(rolls)
	useEffect(() => {
		if (seen.current === rolls) return
		seen.current = rolls
		setFace((f) => {
			let n = f
			while (n === f) n = 2 + Math.floor(Math.random() * 5)
			return n
		})
	}, [rolls])
	return (
		<motion.button
			type="button"
			onClick={onRoll}
			whileTap={{ scale: 0.9 }}
			aria-label="Roll the dice: a random mood and shape"
			title="Roll the dice"
			className={`grid shrink-0 touch-manipulation place-items-center bg-amber-400 text-gray-950 shadow-[0_6px_18px_-6px_rgba(251,191,36,.6)] hover:bg-amber-300 ${small ? "size-11 rounded-xl" : "size-12 rounded-2xl"}`}
			data-dice={face}
		>
			<motion.svg
				viewBox="0 0 24 24"
				className={small ? "size-6" : "size-7"}
				aria-hidden="true"
				initial={false}
				animate={{ rotate: rolls * 360 + (rolls % 2 ? 90 : 0) }}
				transition={{ type: "spring", stiffness: 160, damping: 14 }}
			>
				<rect
					x="2.5"
					y="2.5"
					width="19"
					height="19"
					rx="5"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
				/>
				{PIPS[face].map(([x, y]) => (
					<circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="currentColor" />
				))}
			</motion.svg>
		</motion.button>
	)
}
