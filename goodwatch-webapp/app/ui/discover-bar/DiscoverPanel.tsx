// The panel: what opens under the Discover bar on desktop, and the sheet on phones. Both hold the open tab's header
// row (TabHeader), the open sub-tab's content (or Find's results while Find has text), and the panel footer.
//
// Desktop: under the bar (opacity, an 8 px rise, scale 0.97 to 1, 0.2 s). Switching tabs slides the row and content
// 28 px in tab order. The content area is 400 px high and scrolls inside, so the page never shifts.
// Phones: a PhoneSheet labeled "Filters", with the four tabs and the header row in its header.
//
// The four sheet tabs and each header row's sub-tabs are tab lists; the sheet's body is the main tabs' panel, and the
// open sub-tab's content is the sub-tabs' panel.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, type Ref, useEffect, useId, useRef } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import { TabBadge } from "./DiscoverBar"
import { PhoneSheet } from "./PhoneSheet"
import { TabHeader, onTabListKey, tabElementId } from "./TabHeader"
import {
	MAIN_TABS,
	MAIN_TAB_LABELS,
	type MainTab,
	type SubTab,
	type SubTabId,
} from "./tabs"

/** The desktop content area's height, under the 48 px header row. */
export const CONTENT_HEIGHT = 400
/** Phones: the least height of a sub-tab's content in the sheet. */
export const PHONE_CONTENT_MIN_HEIGHT = 420

const EASE = [0.22, 1, 0.36, 1] as const
const TAB_SLIDE = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const TAB_SLIDE_TRANSITION = { duration: 0.2, ease: EASE }
const PILL_SPRING = { type: "spring", stiffness: 520, damping: 42 } as const

/** A sub-tab's content until its step fills it: an empty area of the content's final height. */
export function SubTabSlot({ id, phone }: { id: SubTabId; phone: boolean }) {
	return (
		<div
			data-sub-tab-slot={id}
			aria-hidden
			className={phone ? "w-full" : "h-full w-full"}
			style={phone ? { minHeight: PHONE_CONTENT_MIN_HEIGHT } : undefined}
		/>
	)
}

/** The open sub-tab, faded in when it changes. It's the sub-tabs' panel, except while it shows Find's results. */
function SubTabContent({
	id,
	phone,
	panelId,
	labelledBy,
	children,
}: {
	id: string
	phone: boolean
	panelId: string
	/** The open sub-tab's id; null while Find's results show. */
	labelledBy: string | null
	children: ReactNode
}) {
	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				id={panelId}
				role={labelledBy ? "tabpanel" : undefined}
				aria-labelledby={labelledBy ?? undefined}
				key={id}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.14 }}
				className={phone ? "" : "h-full min-h-0"}
				data-sub-tab-content={id}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	)
}

/** Desktop: the content area keeps its scroll short; a new sub-tab or Find starts at the top. */
function ContentArea({ id, children }: { id: string; children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (ref.current) ref.current.scrollTop = 0
	}, [id])
	return (
		<div
			ref={ref}
			className="relative min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain"
			style={{ height: CONTENT_HEIGHT }}
		>
			{children}
		</div>
	)
}

export interface PanelTab {
	tab: MainTab
	/** 1: the new tab is to the right of the last one. */
	dir: 1 | -1
	subTabs: SubTab[]
	active: SubTabId
	badges: Partial<Record<SubTabId, number>>
	onPickSub: (id: SubTabId) => void
	/** Find has text: its results show in place of the sub-tab. */
	finding: boolean
	/** The sub-tab's content, or Find's results. */
	content: ReactNode
}

export function DiscoverPanel({
	id,
	tab,
	find,
	footer,
	panelRef,
}: {
	id: string
	tab: PanelTab
	/** The Find field. */
	find: ReactNode
	footer: ReactNode
	panelRef?: Ref<HTMLDivElement>
}) {
	const base = useId()
	const idBase = `${base}-${tab.tab}`
	const panelId = `${idBase}-panel`
	return (
		<motion.div
			ref={panelRef}
			id={id}
			// biome-ignore lint/a11y/useSemanticElements: an animated panel; <dialog> can't animate out
			role="dialog"
			aria-label={MAIN_TAB_LABELS[tab.tab]}
			initial={{ opacity: 0, y: -8, scale: 0.97 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -6, scale: 0.98 }}
			transition={TAB_SLIDE_TRANSITION}
			style={{ transformOrigin: "top center" }}
			className="absolute inset-x-0 top-[86px] z-40 flex flex-col overflow-hidden rounded-[24px] bg-gray-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
		>
			<div
				className="relative shrink-0 overflow-hidden"
				style={{ height: CONTENT_HEIGHT + 48 }}
			>
				<AnimatePresence initial={false} custom={tab.dir}>
					<motion.div
						key={tab.tab}
						custom={tab.dir}
						variants={TAB_SLIDE}
						initial="enter"
						animate="center"
						exit="exit"
						transition={TAB_SLIDE_TRANSITION}
						className="absolute inset-0 flex flex-col"
					>
						<TabHeader
							subTabs={tab.subTabs}
							active={tab.active}
							badges={tab.badges}
							onPick={tab.onPickSub}
							dim={tab.finding}
							phone={false}
							find={find}
							layoutId={`discover-sub-${tab.tab}`}
							idBase={idBase}
							panelId={panelId}
						/>
						<ContentArea id={tab.finding ? "find" : tab.active}>
							<SubTabContent
								id={tab.finding ? "find" : tab.active}
								phone={false}
								panelId={panelId}
								labelledBy={
									tab.finding ? null : tabElementId(idBase, tab.active)
								}
							>
								{tab.content}
							</SubTabContent>
						</ContentArea>
					</motion.div>
				</AnimatePresence>
			</div>
			{footer}
		</motion.div>
	)
}

/** The grid under the open desktop panel, dimmed. Phones have the sheet's own backdrop. */
export function GridDim({ on }: { on: boolean }) {
	return (
		<AnimatePresence>
			{on && (
				<motion.div
					aria-hidden
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18 }}
					className="absolute inset-0 z-30 hidden bg-gray-950/50 lg:block"
				/>
			)}
		</AnimatePresence>
	)
}

/** The sheet's four tabs, 13 px labels, with their badges. */
function SheetTabs({
	open,
	badges,
	onPick,
	idBase,
	panelId,
}: {
	open: MainTab
	badges: Record<MainTab, number>
	onPick: (tab: MainTab) => void
	idBase: string
	/** The sheet's body, which the tabs control. */
	panelId: string
}) {
	return (
		<div
			role="tablist"
			aria-label="Filters"
			className="flex gap-0.5 px-2 pt-1 pb-1"
			onKeyDown={(event) =>
				onTabListKey(event, MAIN_TABS, open, onPick, idBase)
			}
		>
			{MAIN_TABS.map((tab) => {
				const on = open === tab
				return (
					<motion.button
						key={tab}
						type="button"
						role="tab"
						id={tabElementId(idBase, tab)}
						aria-selected={on}
						aria-controls={panelId}
						tabIndex={on ? 0 : -1}
						whileTap={TAP}
						onClick={() => onPick(tab)}
						data-tab={tab}
						className={`relative flex h-10 min-w-0 flex-1 items-center justify-center rounded-full px-1.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-gray-950" : "text-gray-300"}`}
					>
						{on && (
							<motion.span
								layoutId="discover-sheet-tab"
								transition={PILL_SPRING}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
							{MAIN_TAB_LABELS[tab]}
							<TabBadge n={badges[tab]} size="md" />
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

/** Phones: the sheet keeps its scroll between renders; a new tab, sub-tab or Find starts at the top. */
function useScrollTopOn(ref: React.RefObject<HTMLElement>, key: string) {
	useEffect(() => {
		let el = ref.current?.parentElement ?? null
		while (el) {
			const overflow = getComputedStyle(el).overflowY
			if (overflow === "auto" || overflow === "scroll") {
				el.scrollTop = 0
				return
			}
			el = el.parentElement
		}
	}, [key])
}

export function DiscoverSheet({
	open,
	tab,
	badges,
	onPickTab,
	onClose,
	find,
	findOverlay,
	top,
	footer,
	initialFocus,
}: {
	open: boolean
	/** The tab shown; it stays while the sheet closes. */
	tab: PanelTab
	/** Each main tab's badge. */
	badges: Record<MainTab, number>
	onPickTab: (tab: MainTab) => void
	onClose: () => void
	/** The magnifier that opens Find. */
	find: ReactNode
	/** Find's field over the sub-tabs. */
	findOverlay: ReactNode
	/** Over the content: the search field on Search. */
	top?: ReactNode
	footer: ReactNode
	initialFocus?: React.RefObject<HTMLElement>
}) {
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${tab.tab}|${tab.active}|${tab.finding ? "find" : ""}`)
	const base = useId()
	const tabsBase = `${base}-tabs`
	const bodyId = `${base}-body`
	const subBase = `${base}-${tab.tab}`
	const subPanelId = `${subBase}-panel`
	return (
		<PhoneSheet
			open={open}
			onClose={onClose}
			label="Filters"
			initialFocus={initialFocus}
			header={
				<div>
					<SheetTabs
						open={tab.tab}
						badges={badges}
						onPick={onPickTab}
						idBase={tabsBase}
						panelId={bodyId}
					/>
					<TabHeader
						subTabs={tab.subTabs}
						active={tab.active}
						badges={tab.badges}
						onPick={tab.onPickSub}
						dim={tab.finding}
						phone
						find={find}
						overlay={findOverlay}
						layoutId={`discover-sheet-sub-${tab.tab}`}
						idBase={subBase}
						panelId={subPanelId}
					/>
				</div>
			}
			footer={footer}
		>
			<div
				ref={body}
				id={bodyId}
				role="tabpanel"
				aria-labelledby={tabElementId(tabsBase, tab.tab)}
				className="relative overflow-hidden px-5 pt-4 pb-8"
			>
				<AnimatePresence initial={false} custom={tab.dir} mode="popLayout">
					<motion.div
						key={tab.tab}
						custom={tab.dir}
						variants={TAB_SLIDE}
						initial="enter"
						animate="center"
						exit="exit"
						transition={TAB_SLIDE_TRANSITION}
					>
						{top}
						<SubTabContent
							id={tab.finding ? "find" : tab.active}
							phone
							panelId={subPanelId}
							labelledBy={
								tab.finding ? null : tabElementId(subBase, tab.active)
							}
						>
							{tab.content}
						</SubTabContent>
					</motion.div>
				</AnimatePresence>
			</div>
		</PhoneSheet>
	)
}
