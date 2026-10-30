// The comparison's panels under the strip, on a slightly lighter band split by gray hairlines (round 17 look 3).
// PROTOTYPE OPTIONS (round 19, nav option `venn`): how the three groups (Picks for you, You both love, Only you love)
// open into their full lists (Groups.tsx).
//   swap   A click on a Venn part replaces the Splits area below with that group's list; "Back to where you split"
//          returns, and the open part shows its count in place of its posters.
//   tabs   One tab row over one content area; a compact Venn above it, whose parts are tab targets too.
//   graph  The Venn holds Where you split in its lens (Venn.tsx); a part opens its list below.
//   stage  A click turns the Venn area itself into the group's stage, with a way back; Splits stay below.
// No title shows twice at once: open parts give way to their counts, and the picks panel (your loved titles on their
// wishlist) hides while Only you love is open next to it.
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { ProfileShell } from "~/domain/profile"
import { useNavOptions } from "~/ui/navigation/nav-options"
import { GroupView } from "./Groups"
import { EASE } from "./kit"
import {
	type GroupId,
	Overlap,
	Picks,
	type Plan,
	type Ready,
	Splits,
	planCompare,
	splitsOf,
} from "./parts"
import { GraphVenn, LENS_SPLITS, MiniVenn, TabRow, type TabId } from "./Venn"

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
	const { venn } = useNavOptions()
	const plan = planCompare(handle, compare)
	const [active, setActive] = useState<GroupId | null>(null)
	const [tab, setTab] = useState<TabId>("picks")
	const toggle = (g: GroupId) => setActive(active === g ? null : g)
	// Opening a group brings its list into view when it starts off screen (on phones the Venn's parts stack up).
	const listRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = listRef.current
		if (!active || !el) return
		const top = el.getBoundingClientRect().top
		if (top < 150 || top > window.innerHeight * 0.7)
			el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" })
	}, [active, still])

	let body: ReactNode
	if (venn === "tabs") {
		const panelId = `${sectionId}-tab`
		const splits = splitsOf(compare).length
		body = (
			<>
				<Cell
					still={still}
					className="flex flex-col gap-4 px-5 pt-6 sm:px-8 sm:pt-8"
				>
					<MiniVenn
						plan={plan}
						splits={splits}
						tab={tab}
						onPick={setTab}
						controls={panelId}
					/>
					<TabRow
						plan={plan}
						splits={splits}
						tab={tab}
						onPick={setTab}
						controls={panelId}
					/>
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
			</>
		)
	} else if (venn === "graph") {
		body = (
			<>
				<Cell still={still}>
					<GraphVenn
						plan={plan}
						c={compare}
						handle={handle}
						active={active}
						onOpen={toggle}
					/>
				</Cell>
				<div ref={listRef} className="scroll-mt-40">
					<Swap k={active ?? "rest"} still={still}>
						{active ? (
							<div className={`border-t ${LINE}`}>
								<GroupView
									id={active}
									plan={plan}
									c={compare}
									control={
										<Control icon="close" onClick={() => setActive(null)}>
											Close
										</Control>
									}
								/>
							</div>
						) : (
							<Lower
								handle={handle}
								c={compare}
								plan={plan}
								lined
								splits={{ from: LENS_SPLITS, first: 0, title: "More splits" }}
							/>
						)}
					</Swap>
				</div>
			</>
		)
	} else if (venn === "stage") {
		body = (
			<>
				<Cell still={still}>
					<div ref={listRef} className="scroll-mt-40">
						<Swap k={active ?? "venn"} still={still}>
							{active ? (
								<GroupView
									id={active}
									plan={plan}
									c={compare}
									control={
										<Control icon="back" onClick={() => setActive(null)}>
											Back to overview
										</Control>
									}
								/>
							) : (
								<Overlap
									handle={handle}
									plan={plan}
									frame=""
									onOpen={toggle}
									active={null}
								/>
							)}
						</Swap>
					</div>
				</Cell>
				<Lower
					handle={handle}
					c={compare}
					plan={plan}
					lined
					hidePicks={active === "only"}
				/>
			</>
		)
	} else {
		// swap
		body = (
			<>
				<Cell still={still}>
					<Overlap
						handle={handle}
						plan={plan}
						frame=""
						onOpen={toggle}
						active={active}
					/>
				</Cell>
				<div ref={listRef} className="scroll-mt-40">
					<Swap k={active ?? "splits"} still={still}>
						{active ? (
							<div className={`border-t ${LINE}`}>
								<GroupView
									id={active}
									plan={plan}
									c={compare}
									control={
										<Control icon="back" onClick={() => setActive(null)}>
											Back to where you split
										</Control>
									}
								/>
							</div>
						) : (
							<Lower handle={handle} c={compare} plan={plan} lined />
						)}
					</Swap>
				</div>
			</>
		)
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
					{body}
				</motion.section>
			)}
		</AnimatePresence>
	)
}

/** The Splits and the picks panel side by side on wide screens (stacked on phones), under a hairline when `lined`. */
function Lower({
	handle,
	c,
	plan,
	lined = false,
	hidePicks = false,
	splits,
}: {
	handle: string
	c: Ready
	plan: Plan
	lined?: boolean
	hidePicks?: boolean
	splits?: { from: number; first: number; title: string }
}) {
	const hasSplits = splitsOf(c).length > (splits?.from ?? 0)
	const hasPicks = plan.hasPicks && !hidePicks
	if (!hasSplits && !hasPicks) return null
	const both = hasSplits && hasPicks
	return (
		<div
			className={`grid ${lined ? `border-t ${LINE}` : ""} ${both ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : ""}`}
		>
			{hasSplits && <Splits handle={handle} c={c} frame="" {...splits} />}
			{hasPicks && (
				<div className={both ? `max-lg:border-t lg:border-l ${LINE}` : ""}>
					<Picks handle={handle} plan={plan} frame="" />
				</div>
			)}
		</div>
	)
}

/** The way back (or out) at a group list's header. */
function Control({
	icon,
	onClick,
	children,
}: { icon: "back" | "close"; onClick: () => void; children: ReactNode }) {
	const Icon = icon === "back" ? ArrowLeftIcon : XMarkIcon
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-gray-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
		>
			<Icon className="size-4" aria-hidden />
			{children}
		</button>
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
