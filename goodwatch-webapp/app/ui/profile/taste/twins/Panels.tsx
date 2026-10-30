// PROTOTYPE OPTIONS (round 16, nav option `panels`): five ways to present the comparison's panels under the strip,
// none of them boxed. The strip keeps its own surface when open; what changes is the expanded part's background and
// how the overlap, the splits and the picks are separated.
//   1 One surface: the strip's color carries on below the bar, the sections split by hairlines.
//   2 On the page: the strip stays a closed card; the sections sit on the page background below it, with generous
//     space and small uppercase labels.
//   3 Lighter band: a slightly lighter band under the bar, the sections split by hairlines in the match color.
//   4 Alternating: each section on its own subtle background, no lines.
//   5 Inset: a darker well set into the card under the bar, with a margin and an inner shadow, the sections split by
//     faint hairlines.
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import type { ProfileShell } from "~/domain/profile"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { EASE, type Facts } from "./kit"
import { Overlap, Picks, type Ready, Splits } from "./parts"

export type Look = "1" | "2" | "3" | "4" | "5"

/** Whether the panels open inside the strip's card (the bar becomes the seam) rather than below it. */
export const attached = (look: Look) => look !== "2"

/** The card's classes: the strip's surface, the same open or closed. */
export const CARD = "relative rounded-2xl bg-gray-950 ring-1 ring-white/10"

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

/** Small uppercase label over a section (look 2). */
function Label({ children, className }: { children: ReactNode; className: string }) {
	return (
		<p className={`flex items-center gap-2.5 text-[11px] font-bold tracking-[0.16em] text-gray-500 uppercase ${className}`}>
			<span aria-hidden className="h-px w-5 bg-gray-600" />
			{children}
		</p>
	)
}

export function Panels({
	look,
	shell,
	compare,
	f,
	open,
	still,
	label,
	sectionId,
}: {
	look: Look
	shell: ProfileShell
	compare: Ready
	f: Facts
	open: boolean
	still: boolean
	label: string
	sectionId: string
}) {
	const handle = shell.handle
	const hasSplits = compare.shared.length > 0
	const hasPicks = compare.overlap.onlyThem.length > 0 || compare.overlap.onlyYou.some((x) => x.wished)
	const both = hasSplits && hasPicks

	// Per look: the section's own surface, each part's surface, and the lines between them.
	const lined = look === "1" || look === "3" || look === "5"
	const line = look === "1" ? "border-white/[0.08]" : look === "5" ? "border-white/[0.06]" : look === "3" ? "border-white/[0.1]" : ""
	const lineStyle = undefined
	const shade = (i: number) => (look === "4" && i % 2 === 0 ? "bg-white/[0.055]" : "")
	const section = {
		"1": "",
		"2": "mt-8 grid gap-10 sm:mt-10 sm:gap-12",
		"3": "rounded-b-2xl bg-white/[0.065]",
		"4": "overflow-hidden rounded-b-2xl",
		"5": "m-2 mt-3 overflow-hidden rounded-xl bg-black shadow-[inset_0_2px_14px_rgb(0_0_0)] ring-1 ring-white/[0.07] ring-inset sm:m-3 sm:mt-4",
	}[look]
	const top = lined ? `border-t ${line}` : ""
	const side = lined && both ? `max-lg:border-t lg:border-l ${line}` : ""

	const overlap = <Overlap handle={handle} c={compare} frame="" />
	const splits = hasSplits && <Splits handle={handle} c={compare} frame="" />
	const picks = hasPicks && <Picks handle={handle} c={compare} frame="" />

	const body =
		look === "2" ? (
			<>
				<Cell still={still}>
					<Label className="mb-1 px-4 sm:px-6">Overlap</Label>
					{overlap}
				</Cell>
				{(hasSplits || hasPicks) && (
					<Cell still={still}>
						<div className={`grid gap-10 ${both ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8" : ""}`}>
							{splits && (
								<div>
									<Label className="mb-1 px-4 sm:px-5">Splits</Label>
									{splits}
								</div>
							)}
							{picks && (
								<div>
									<Label className="mb-1 px-4 sm:px-5">Picks</Label>
									{picks}
								</div>
							)}
						</div>
					</Cell>
				)}
			</>
		) : (
			<>
				<Cell still={still} className={shade(0)}>
					{overlap}
				</Cell>
				{(hasSplits || hasPicks) && (
					<Cell still={still} className={top} style={lineStyle}>
						<div className={`grid ${both ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : ""}`}>
							{splits && <div className={shade(1)}>{splits}</div>}
							{picks && (
								<div
									className={`${side} ${shade(both ? 2 : 1)}`}
									style={lineStyle}
								>
									{picks}
								</div>
							)}
						</div>
					</Cell>
				)}
			</>
		)

	return (
		<AnimatePresence initial={false}>
			{open && (
				<motion.section
					key="panels"
					id={sectionId}
					aria-label={label}
					className={section}
					initial="hidden"
					animate="shown"
					exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}
					variants={{
						hidden: { opacity: 0 },
						shown: { opacity: 1, transition: { duration: still ? 0 : 0.2, staggerChildren: still ? 0 : 0.06 } },
					}}
				>
					{body}
				</motion.section>
			)}
		</AnimatePresence>
	)
}

function Cell({
	still,
	className = "",
	style,
	children,
}: { still: boolean; className?: string; style?: React.CSSProperties; children: ReactNode }) {
	return (
		<motion.div
			className={className}
			style={style}
			variants={{
				hidden: { opacity: 0, y: still ? 0 : 10 },
				shown: { opacity: 1, y: 0, transition: { duration: still ? 0 : 0.28, ease: EASE } },
			}}
		>
			{children}
		</motion.div>
	)
}
