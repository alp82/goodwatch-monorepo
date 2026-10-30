// The comparison's panels under the strip, on a slightly lighter band split by gray hairlines (round 17 look 3).
// Round 20: the Venn (Venn.tsx) with a tab row under it, over one view: Where you split (the default) or one group's
// full list (Groups.tsx). A Venn part, the split visual and a tab pick the same view, and the picked part and tab light
// up. No title shows twice at once: an open part gives way to its count, and a group's list replaces the Splits and the
// picks panel.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { ProfileShell } from "~/domain/profile"
import { GroupView } from "./Groups"
import { type TabId, TabRow, VennBoard } from "./Venn"
import { EASE } from "./kit"
import {
	Picks,
	type Plan,
	type Ready,
	Splits,
	planCompare,
	splitsOf,
} from "./parts"

/** The card's classes: the strip's surface, the same open or closed. */
export const CARD = "relative rounded-2xl bg-gray-950 ring-1 ring-white/10"

const LINE = "border-white/[0.1]"

export function Panels({
	shell,
	compare,
	open,
	still,
	label,
	sectionId,
}: {
	shell: ProfileShell
	compare: Ready
	open: boolean
	still: boolean
	label: string
	sectionId: string
}) {
	const handle = shell.handle
	const plan = planCompare(handle, compare)
	const rows = splitsOf(compare)
	const splits = {
		n: rows.length,
		gaps: rows.map((r) => Math.abs(r.theirs - r.yours)),
	}
	const [tab, setTab] = useState<TabId>(splits.n ? "splits" : "picks")
	const panelId = `${sectionId}-view`
	// A new view brings the tab row into view when the view starts off screen (on phones the Venn is tall).
	const tabsRef = useRef<HTMLDivElement>(null)
	const picked = useRef(false)
	useEffect(() => {
		const el = tabsRef.current
		if (!picked.current || !el) return
		const top = el.getBoundingClientRect().top
		if (top < 110 || top > window.innerHeight * 0.75)
			el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" })
	}, [tab, still])
	const pick = (t: TabId) => {
		picked.current = true
		setTab(t)
	}

	return (
		<AnimatePresence initial={false}>
			{open && (
				<motion.section
					key="panels"
					id={sectionId}
					aria-label={label}
					className="rounded-b-2xl bg-white/[0.065]"
					initial="hidden"
					animate="shown"
					exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}
					variants={{
						hidden: { opacity: 0 },
						shown: {
							opacity: 1,
							transition: {
								duration: still ? 0 : 0.2,
								staggerChildren: still ? 0 : 0.06,
							},
						},
					}}
				>
					<Cell still={still} className="overflow-hidden pt-2 sm:pt-4">
						<VennBoard
							handle={handle}
							plan={plan}
							splits={splits}
							tab={tab}
							onPick={pick}
							controls={panelId}
						/>
						<div ref={tabsRef} className="mt-2 scroll-mt-36 md:mt-1">
							<TabRow
								plan={plan}
								splits={splits.n}
								tab={tab}
								onPick={pick}
								controls={panelId}
								layoutId={`${sectionId}-tab`}
							/>
						</div>
					</Cell>
					<Cell still={still} className={`border-t ${LINE}`}>
						<div id={panelId} role="tabpanel">
							<Swap k={tab} still={still}>
								{tab === "splits" ? (
									<Lower handle={handle} c={compare} plan={plan} />
								) : (
									<GroupView id={tab} plan={plan} c={compare} />
								)}
							</Swap>
						</div>
					</Cell>
				</motion.section>
			)}
		</AnimatePresence>
	)
}

/** The Splits and the picks panel side by side on wide screens (stacked on phones). */
function Lower({ handle, c, plan }: { handle: string; c: Ready; plan: Plan }) {
	const hasSplits = splitsOf(c).length > 0
	const hasPicks = plan.hasPicks
	if (!hasSplits && !hasPicks) return null
	const both = hasSplits && hasPicks
	return (
		<div
			className={`grid ${both ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : ""}`}
		>
			{hasSplits && <Splits handle={handle} c={c} frame="" />}
			{hasPicks && (
				<div className={both ? `max-lg:border-t lg:border-l ${LINE}` : ""}>
					<Picks handle={handle} plan={plan} frame="" />
				</div>
			)}
		</div>
	)
}

/** A crossfade between what one area shows (opacity only). */
function Swap({
	k,
	still,
	children,
}: { k: string; still: boolean; children: ReactNode }) {
	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={k}
				initial={{ opacity: 0 }}
				animate={{
					opacity: 1,
					transition: { duration: still ? 0 : 0.22, ease: EASE },
				}}
				exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	)
}

function Cell({
	still,
	className = "",
	children,
}: { still: boolean; className?: string; children: ReactNode }) {
	return (
		<motion.div
			className={className}
			variants={{
				hidden: { opacity: 0, y: still ? 0 : 10 },
				shown: {
					opacity: 1,
					y: 0,
					transition: { duration: still ? 0 : 0.28, ease: EASE },
				},
			}}
		>
			{children}
		</motion.div>
	)
}
