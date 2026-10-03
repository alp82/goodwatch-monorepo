// Watch next's controls on phones (below the large breakpoint): the slab's three buttons at the bottom, moods,
// services, and sort, each opening its own drawer (owner addendum on #176). With the site's dock (REC_NAVIGATION)
// the buttons dock above it; otherwise the slab frame carries them over the site navigation. Every drawer is a
// labeled modal sheet with a focus trap, closing with Escape, the backdrop, a drag down, or its Show button.
import {
	ArrowsUpDownIcon,
	GlobeAltIcon,
	PlusIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import type React from "react"
import { useRef, useState } from "react"
import { MAX_MOODS, MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import type { WatchNextSort } from "~/domain/watch-next"
import type { WatchNext } from "~/server/watch-next.server"
import { SlabShell, SnapSheet } from "~/ui/filter-bar"
import { ServiceStack, radioKeys } from "~/ui/filter-bar/controls"
import { Knob, SPRING, TAP } from "~/ui/filter-bar/motion"
import { DockStrip, useHasDock } from "~/ui/navigation"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import {
	type MoodControl,
	MoodGrid,
	SPECTRUM,
	useRefusalHint,
} from "./MoodPicker"
import {
	RATE_MORE,
	SORT_LABEL,
	SORT_OPTIONS,
	moodsShort,
	titleCount,
} from "./labels"

type Drawer = "moods" | "services" | "sort"

const DRAWER_LABEL: Record<Drawer, string> = {
	moods: "Moods",
	services: "Where to watch",
	sort: "Sort",
}

/** One of the slab's buttons: an icon over a short label. */
const SEGMENT =
	"relative flex h-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] px-1.5 text-[12px] font-bold outline-none transition-colors active:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"

// The services drawer holds one switch; the other two scroll from about half the screen to nearly all of it. The
// sort drawer opens taller while it carries a guest's sign-up card, so the card shows whole.
const SERVICES_SNAPS = [0.36]
const SORT_WITH_PROMPT_SNAPS = [0.76, 0.94]

export interface PhoneControlsProps {
	data: WatchNext | null
	moods: MoodControl | null
	setOnMyServices: (on: boolean) => void
	setSort: (sort: WatchNextSort) => void
}

function MoodDots({ moods }: { moods: readonly MoodKey[] }) {
	const shown = moods.length ? moods : SPECTRUM
	return (
		<span className="flex -space-x-1" aria-hidden>
			{shown.map((mood) => (
				<motion.span
					key={mood}
					layout
					initial={{ scale: 0.4 }}
					animate={{ scale: 1 }}
					className="h-3.5 w-3.5 rounded-full ring-2 ring-gray-950"
					style={{
						background: MOOD_BY_KEY[mood].hue,
						opacity: moods.length ? 1 : 0.55,
					}}
				/>
			))}
		</span>
	)
}

// "Show 23 that fit", "Show 151 on your services", "Show 349 titles"; "Done" when there is nothing to show.
function showLabel(data: WatchNext | null): string {
	if (!data) return "Done"
	const filtered = data.moods.length > 0 || data.onMyServices
	const n = filtered ? data.fitting : data.total
	if (!n) return "Done"
	if (!filtered) return `Show ${titleCount(n)}`
	return data.moods.length ? `Show ${n} that fit` : `Show ${n} on your services`
}

function ShowButton({
	data,
	onClick,
}: { data: WatchNext | null; onClick: () => void }) {
	return (
		<div className="shrink-0 border-t border-white/10 bg-gray-950/95 px-4 pt-3 pb-4">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onClick}
				data-drawer-done
				className="h-12 w-full cursor-pointer rounded-2xl bg-white text-base font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				{showLabel(data)}
			</motion.button>
		</div>
	)
}

/** A drawer's top line, in the sheet's drag area. */
function DrawerHead({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-11 items-center gap-3 px-4 pb-1">{children}</div>
	)
}

function MoodsHead({ control }: { control: MoodControl }) {
	const k = control.moods.length
	const hint = useRefusalHint(control)
	return (
		<DrawerHead>
			<AnimatePresence mode="wait" initial={false}>
				{hint ? (
					<motion.p
						key="hint"
						data-hint
						initial={{ opacity: 0 }}
						animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.35 }}
						className="min-w-0 flex-1 text-sm font-semibold text-amber-300"
					>
						{hint}
					</motion.p>
				) : (
					<motion.h2
						key="title"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.08 } }}
						className="min-w-0 flex-1 text-base font-bold text-white"
					>
						Moods{" "}
						<span className="text-sm font-normal text-gray-400">
							up to three
						</span>
					</motion.h2>
				)}
			</AnimatePresence>
			<span
				className={`shrink-0 text-sm tabular-nums ${k === MAX_MOODS ? "font-semibold text-amber-300" : "text-gray-400"}`}
			>
				{k} of {MAX_MOODS}
			</span>
			{k > 0 && (
				<button
					type="button"
					onClick={control.clear}
					className="min-h-11 shrink-0 cursor-pointer rounded-full px-2.5 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
		</DrawerHead>
	)
}

function ServicesBody({
	data,
	setOnMyServices,
}: {
	data: WatchNext
	setOnMyServices: (on: boolean) => void
}) {
	if (!data.hasServices)
		return (
			<div className="px-4 pb-4">
				<Link
					to="/settings/streaming"
					className="flex w-full items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-left ring-1 ring-white/10"
				>
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
						<PlusIcon className="h-5 w-5 text-gray-200" aria-hidden />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-sm font-bold text-white">
							Add my services
						</span>
						<span className="block text-xs text-gray-400">
							Pick your streaming services and what you can play comes first.
						</span>
					</span>
				</Link>
			</div>
		)
	const on = data.onMyServices
	return (
		<div className="px-4 pb-4">
			<motion.button
				type="button"
				role="switch"
				aria-checked={on}
				whileTap={TAP}
				data-services-switch
				onClick={() => setOnMyServices(!on)}
				className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-left ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<ServiceStack providers={data.myServices} on={on} size={28} />
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-bold text-white">
						On my services
					</span>
					<span className="block text-xs text-gray-400">
						{on
							? "What you can play right now comes first."
							: "Off: titles on any service count the same."}
					</span>
				</span>
				<Knob
					on={on}
					size="lg"
					onClass="bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,.45)]"
				/>
			</motion.button>
		</div>
	)
}

/** A guest's sort drawer carries the sign-up prompt for Best match. */
const signUpPrompted = (data: WatchNext) =>
	data.bestMatch.prompt === "signUpToLearn" ||
	data.bestMatch.prompt === "signUpToKeep"

function SortBody({
	data,
	setSort,
	checkedRef,
}: {
	data: WatchNext
	setSort: (sort: WatchNextSort) => void
	/** The checked sort, where focus goes when the drawer opens. */
	checkedRef: React.RefObject<HTMLButtonElement>
}) {
	const { bestMatch } = data
	const pick = (sort: WatchNextSort) => {
		if (sort === "match" && !bestMatch.available) return
		setSort(sort)
	}
	const guestPrompt = signUpPrompted(data)
	return (
		<div className="px-4 pb-4">
			<div
				className="grid grid-cols-2 gap-2"
				role="radiogroup"
				aria-label="Sort"
				onKeyDown={(event) =>
					radioKeys(event, (index) => pick(SORT_OPTIONS[index].key))
				}
			>
				{SORT_OPTIONS.map((option) => {
					const on = option.key === data.sort
					const unavailable = option.key === "match" && !bestMatch.available
					return (
						<motion.button
							key={option.key}
							ref={on ? checkedRef : undefined}
							// biome-ignore lint/a11y/useSemanticElements: a tile grid; the buttons carry the radio role and arrow keys
							type="button"
							role="radio"
							aria-checked={on}
							aria-disabled={unavailable || undefined}
							tabIndex={on ? 0 : -1}
							data-sort={option.key}
							whileTap={unavailable ? undefined : TAP}
							onClick={() => pick(option.key)}
							// Amber marks what taste decides: only Best match lights up amber.
							className={`flex cursor-pointer flex-col items-start rounded-xl p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? (option.key === "match" ? "bg-amber-400 text-black" : "bg-white text-black") : "bg-white/[0.05] text-white ring-1 ring-white/10"} ${unavailable ? "cursor-default opacity-60" : ""}`}
						>
							<span className="text-sm font-bold">{option.label}</span>
							<span
								className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${on ? "text-black/70" : "text-gray-400"}`}
							>
								{unavailable && bestMatch.prompt === "rateMore"
									? RATE_MORE
									: option.hint}
							</span>
						</motion.button>
					)
				})}
			</div>
			{guestPrompt && (
				<SignUpPrompt
					feature="bestMatch"
					stage={bestMatch.prompt === "signUpToKeep" ? "keep" : "learn"}
					size="card"
					className="mt-4"
				/>
			)}
		</div>
	)
}

/** The slab's three buttons. */
function Segments({
	data,
	moods,
	open,
	onOpen,
}: {
	data: WatchNext
	moods: readonly MoodKey[]
	open: Drawer | null
	onOpen: (drawer: Drawer) => void
}) {
	const picked = moods.length > 0
	const segment = (drawer: Drawer) => ({
		type: "button" as const,
		"aria-haspopup": "dialog" as const,
		"aria-expanded": open === drawer,
		"data-segment": drawer,
		whileTap: TAP,
		onClick: () => onOpen(drawer),
	})
	const services = !data.hasServices
		? "Add services"
		: data.onMyServices
			? "My services"
			: "Everywhere"
	return (
		<>
			<motion.button
				{...segment("moods")}
				aria-label={`Moods: ${picked ? moods.map((m) => MOOD_BY_KEY[m].name).join(", ") : "any"}`}
				className={`${SEGMENT} flex-[1.25] ${picked ? "bg-white/[0.07] text-white" : "text-gray-300"}`}
			>
				<MoodDots moods={moods} />
				<span className="w-full truncate text-center">{moodsShort(moods)}</span>
			</motion.button>
			<motion.button
				{...segment("services")}
				aria-label={`Where to watch: ${services}`}
				className={`${SEGMENT} flex-1 ${data.hasServices && data.onMyServices ? "text-white" : "text-gray-300"}`}
			>
				{!data.hasServices ? (
					<PlusIcon className="h-4 w-4" aria-hidden />
				) : data.onMyServices ? (
					<ServiceStack providers={data.myServices} on size={16} />
				) : (
					<GlobeAltIcon className="h-[18px] w-[18px]" aria-hidden />
				)}
				<span className="w-full truncate text-center">{services}</span>
			</motion.button>
			<motion.button
				{...segment("sort")}
				aria-label={`Sort: ${SORT_LABEL[data.sort]}`}
				className={`${SEGMENT} flex-1 text-white`}
			>
				<ArrowsUpDownIcon
					className={`h-4 w-4 ${data.sort === "match" ? "text-amber-400" : "text-gray-400"}`}
					aria-hidden
				/>
				<span className="relative w-full overflow-hidden text-center">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={data.sort}
							initial={{ y: 12, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -12, opacity: 0 }}
							transition={SPRING}
							className="block truncate"
						>
							{SORT_LABEL[data.sort]}
						</motion.span>
					</AnimatePresence>
				</span>
			</motion.button>
		</>
	)
}

// While the first view loads: the three buttons' places, so nothing jumps when they arrive.
function LoadingSegments() {
	return (
		<>
			{[1.25, 1, 1].map((grow, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: three fixed placeholders
					key={i}
					aria-hidden
					className="m-1 animate-pulse rounded-[12px] bg-white/[0.06]"
					style={{ flex: grow }}
				/>
			))}
		</>
	)
}

export function PhoneControls({
	data,
	moods,
	setOnMyServices,
	setSort,
}: PhoneControlsProps) {
	const [open, setOpen] = useState<Drawer | null>(null)
	const checkedSort = useRef<HTMLButtonElement>(null)
	const hasDock = useHasDock()
	const close = () => setOpen(null)
	const segments =
		data && moods ? (
			<Segments data={data} moods={moods.moods} open={open} onOpen={setOpen} />
		) : (
			<LoadingSegments />
		)
	const sheet = (drawer: Drawer) => ({
		index: open === drawer ? 0 : -1,
		onIndex: (index: number) => setOpen(index < 0 ? null : drawer),
		label: DRAWER_LABEL[drawer],
		footer: <ShowButton data={data} onClick={close} />,
	})

	return (
		<MotionConfig reducedMotion="user">
			{hasDock ? (
				<DockStrip>
					<div
						className="flex h-[52px] min-w-0 flex-1 items-stretch gap-1 rounded-[18px] bg-white/[0.05] p-1 ring-1 ring-white/10"
						data-watch-next-strip
					>
						{segments}
					</div>
				</DockStrip>
			) : (
				<SlabShell strip={segments} />
			)}
			{data && moods && (
				<>
					<SnapSheet {...sheet("moods")} header={<MoodsHead control={moods} />}>
						<div className="px-4 pt-1 pb-4" data-drawer="moods">
							<MoodGrid control={moods} dense />
						</div>
					</SnapSheet>
					<SnapSheet
						{...sheet("services")}
						snaps={SERVICES_SNAPS}
						header={
							<DrawerHead>
								<h2 className="text-base font-bold text-white">
									Where to watch
								</h2>
							</DrawerHead>
						}
					>
						<div data-drawer="services">
							<ServicesBody data={data} setOnMyServices={setOnMyServices} />
						</div>
					</SnapSheet>
					<SnapSheet
						{...sheet("sort")}
						snaps={signUpPrompted(data) ? SORT_WITH_PROMPT_SNAPS : undefined}
						initialFocus={checkedSort}
						header={
							<DrawerHead>
								<h2 className="text-base font-bold text-white">Sort</h2>
							</DrawerHead>
						}
					>
						<div data-drawer="sort">
							<SortBody
								data={data}
								setSort={setSort}
								checkedRef={checkedSort}
							/>
						</div>
					</SnapSheet>
				</>
			)}
		</MotionConfig>
	)
}
