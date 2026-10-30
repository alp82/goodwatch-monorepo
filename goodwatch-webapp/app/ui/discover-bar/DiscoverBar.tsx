// The Discover bar: the four main tabs as one row of segments (desktop) or Search over a row of three (phones). Each
// segment shows its label with a badge and its value line (tabs.ts tabValues), led by mood hues, service logos, or You's
// fingerprint (a lock for guests). While the desktop panel is open, the Search segment turns into the search field.
import {
	LockClosedIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type { ReactNode, Ref } from "react"
import { useSearchCombobox } from "./search/combobox"
import { MOOD_BY_KEY } from "~/domain/moods"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { TAP } from "~/ui/filter-bar/motion"
import type { StreamingProvider } from "~/ui/filter-bar/useFilterData"
import {
	MAIN_TABS,
	MAIN_TAB_FLEX,
	type MainTab,
	SEARCH_PLACEHOLDER,
	type TabValue,
} from "./tabs"

/** Kept out of analytics, replays and error reports: what a person types. */
export const PRIVATE = "search-private ph-no-capture sentry-mask"

const PILL_SPRING = { type: "spring", stiffness: 520, damping: 42 } as const

export interface BarProviders {
	/** The viewer's saved services (On my services). */
	mine: StreamingProvider[]
	/** Every service of the streaming country. */
	country: StreamingProvider[]
}

/** A small amber count: the active choices of a tab or sub-tab. */
export function TabBadge({
	n,
	size = "sm",
}: { n: number; size?: "sm" | "md" }) {
	if (!n) return null
	return (
		<span
			className={`grid place-items-center rounded-full bg-amber-500 px-1 font-bold tracking-normal text-gray-950 tabular-nums ${size === "md" ? "h-4.5 min-w-4.5 text-[11px]" : "h-4 min-w-4 text-[10px]"}`}
		>
			{n}
		</span>
	)
}

function SegmentLabel({ value }: { value: TabValue }) {
	const search = value.tab === "search"
	return (
		<span
			className={`flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase ${search ? "text-amber-300/90" : value.locked ? "text-gray-500" : "text-gray-400"}`}
		>
			{search && <MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />}
			{value.label}
			<TabBadge n={value.badge} />
		</span>
	)
}

/** Up to four mood hues, overlapping. */
function MoodHues({ value, size }: { value: TabValue; size: number }) {
	const moods = (value.moods ?? []).slice(0, 4)
	if (!moods.length) return null
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			{moods.map((key, i) => (
				<span
					key={key}
					className="rounded-full ring-2 ring-gray-950"
					style={{
						width: size,
						height: size,
						background: MOOD_BY_KEY[key]?.hue,
						marginLeft: i ? -size / 3 : 0,
					}}
				/>
			))}
		</span>
	)
}

/** What leads a segment's value line. */
function Lead({
	value,
	providers,
	phone,
}: {
	value: TabValue
	providers: BarProviders
	phone: boolean
}) {
	if (value.tab === "mood")
		return <MoodHues value={value} size={phone ? 9 : 10} />
	if (value.tab === "watch" && value.services) {
		const shown =
			value.services === "mine"
				? providers.mine
				: providers.country.filter((p) =>
						(value.services as number[]).includes(p.id),
					)
		return <ServiceStack providers={shown} on size={phone ? 14 : 16} />
	}
	if (value.tab === "you")
		return value.locked ? (
			<LockClosedIcon
				className="h-3.5 w-3.5 shrink-0 text-amber-500/70"
				aria-hidden
			/>
		) : (
			<FingerPrintIcon
				className="h-4 w-4 shrink-0 text-amber-500"
				aria-hidden
			/>
		)
	return null
}

/** The value line's text: the search in large type, a value, the guest's "Sign up", or the placeholder. */
function ValueText({ value, phone }: { value: TabValue; phone: boolean }) {
	if (value.tab === "search" && (value.query || !value.value))
		return (
			<span
				className={`brand-header truncate leading-tight ${phone ? "text-[19px]" : "text-[21px]"} ${value.query ? "text-white" : "text-gray-500"} ${PRIVATE}`}
			>
				{value.query ?? value.placeholder}
			</span>
		)
	const shown = value.value ?? value.placeholder
	const tone = value.value
		? "font-semibold text-white"
		: value.locked
			? "font-semibold text-amber-200/80"
			: "text-gray-500"
	return (
		<span
			className={`truncate ${phone ? "text-[13px]" : "text-[15px]"} ${tone}`}
		>
			{shown}
		</span>
	)
}

function ClearSearch({
	onClick,
	className,
}: {
	onClick: () => void
	className: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Clear the search"
			className={`grid place-items-center rounded-full text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
		>
			<XMarkIcon className="h-4 w-4" />
		</button>
	)
}

/** Desktop: one row, 76 px, the segments sized by MAIN_TAB_FLEX. */
export function DiscoverBar({
	values,
	active,
	onPick,
	onClearSearch,
	providers,
	search,
	barRef,
	panelId,
	strip,
}: {
	/** PROTOTYPE essentials B: a strip under the segments. */
	strip?: ReactNode
	values: Record<MainTab, TabValue>
	/** The open tab; null while the panel is closed. */
	active: MainTab | null
	onPick: (tab: MainTab) => void
	onClearSearch: () => void
	providers: BarProviders
	/** The search field, in the Search segment while the panel is open. */
	search?: ReactNode
	barRef?: Ref<HTMLDivElement>
	/** The panel's id, for aria-controls. */
	panelId: string
}) {
	const row = (
		<div
			ref={strip ? undefined : barRef}
			role="group"
			aria-label="Discover filters"
			className={`relative flex h-[76px] items-stretch rounded-full p-1.5 ring-1 ${
				active
					? "bg-gray-900 ring-white/15"
					: "bg-white/[0.045] ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_20px_50px_-30px_rgba(0,0,0,.9)]"
			}`}
		>
			{MAIN_TABS.map((tab, i) => {
				const value = values[tab]
				const on = active === tab
				const nextOn = active === MAIN_TABS[i + 1]
				const isSearch = tab === "search"
				return (
					<div
						key={tab}
						data-tab={tab}
						className="relative flex min-w-0"
						style={{ flex: `${MAIN_TAB_FLEX[tab]} 1 0%` }}
					>
						{on && (
							<motion.span
								layoutId="discover-bar-pill"
								transition={PILL_SPRING}
								className="absolute inset-0 rounded-full bg-white/[0.1] ring-1 ring-white/20 shadow-[0_10px_30px_-10px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.08)]"
							/>
						)}
						{isSearch && search ? (
							<div className="relative flex min-w-0 flex-1 flex-col justify-center pr-1.5 pl-7">
								<SegmentLabel value={value} />
								{search}
							</div>
						) : (
							<motion.button
								type="button"
								whileTap={{ scale: 0.985 }}
								onClick={() => onPick(tab)}
								aria-expanded={on}
								aria-controls={on ? panelId : undefined}
								className={`relative flex min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
									isSearch ? "pr-12 pl-7" : "px-5"
								} ${on ? "" : "hover:bg-white/[0.05]"}`}
							>
								<SegmentLabel value={value} />
								<span className="mt-0.5 flex min-w-0 items-center gap-2">
									<Lead value={value} providers={providers} phone={false} />
									<ValueText value={value} phone={false} />
								</span>
							</motion.button>
						)}
						{isSearch && value.query && !search && (
							<ClearSearch
								onClick={onClearSearch}
								className="absolute top-1/2 right-3 h-8 w-8 -translate-y-1/2"
							/>
						)}
						{i < MAIN_TABS.length - 1 && (
							<span
								aria-hidden
								className={`absolute top-1/2 -right-px h-8 w-px -translate-y-1/2 bg-white/10 transition-opacity ${on || nextOn ? "opacity-0" : ""}`}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
	if (!strip) return row
	return (
		<div
			ref={barRef}
			className="overflow-hidden rounded-[38px] bg-white/[0.02] ring-1 ring-white/10"
		>
			{row}
			{strip}
		</div>
	)
}

/** Phones: Search on its own 62 px row, then Mood, Watch and You on a 52 px row. */
export function PhoneDiscoverBar({
	values,
	onPick,
	onClearSearch,
	providers,
	strip,
}: {
	values: Record<MainTab, TabValue>
	onPick: (tab: MainTab) => void
	onClearSearch: () => void
	providers: BarProviders
	/** PROTOTYPE essentials B. */
	strip?: ReactNode
}) {
	const search = values.search
	return (
		<div className="overflow-hidden rounded-[22px] bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
			<div className="relative">
				<button
					type="button"
					data-tab="search"
					onClick={() => onPick("search")}
					className="flex h-[62px] w-full cursor-pointer flex-col justify-center px-4 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
				>
					<SegmentLabel value={search} />
					<span className="mt-0.5 flex min-w-0">
						<ValueText value={search} phone />
					</span>
				</button>
				{search.query && (
					<ClearSearch
						onClick={onClearSearch}
						className="absolute top-1/2 right-2 h-9 w-9 -translate-y-1/2"
					/>
				)}
			</div>
			<div className="grid grid-cols-[1fr_1fr_0.8fr] border-t border-white/[0.08]">
				{MAIN_TABS.filter((tab) => tab !== "search").map((tab, i) => {
					const value = values[tab]
					return (
						<motion.button
							key={tab}
							type="button"
							data-tab={tab}
							whileTap={TAP}
							onClick={() => onPick(tab)}
							className={`flex h-[52px] min-w-0 cursor-pointer flex-col justify-center px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${i ? "border-l border-white/[0.08]" : ""}`}
						>
							<SegmentLabel value={value} />
							<span className="flex min-w-0 items-center gap-1.5">
								<Lead value={value} providers={providers} phone />
								<ValueText value={value} phone />
							</span>
						</motion.button>
					)
				})}
			</div>
			{strip}
		</div>
	)
}

/** The search as a live field: the bar's Search segment while the panel is open, and the phone sheet's Search tab. */
export function SearchInput({
	value,
	onChange,
	onEnter,
	onEscape,
	onFocus,
	inputRef,
	size = "lg",
}: {
	value: string
	onChange: (text: string) => void
	/** Enter: runs the search. */
	onEnter: () => void
	onEscape?: () => void
	onFocus?: () => void
	inputRef?: Ref<HTMLInputElement>
	size?: "lg" | "md"
}) {
	const grid = useSearchCombobox()
	return (
		<input
			ref={inputRef}
			type="search"
			value={value}
			maxLength={200}
			autoComplete="off"
			enterKeyHint="search"
			aria-label="Search"
			role="combobox"
			aria-autocomplete="list"
			aria-haspopup="grid"
			aria-expanded={grid !== null}
			aria-controls={grid?.id}
			aria-activedescendant={grid?.activeId}
			// The Search tab's lists take arrow keys and Enter while focus is here.
			data-discover-search=""
			placeholder={SEARCH_PLACEHOLDER}
			onChange={(event) => onChange(event.target.value)}
			onFocus={onFocus}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault()
					onEnter()
				} else if (event.key === "Escape" && onEscape) {
					event.preventDefault()
					onEscape()
				}
			}}
			className={`brand-header w-full min-w-0 border-0 bg-transparent p-0 leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE} ${size === "lg" ? "mt-0.5 text-[21px]" : "text-[19px]"}`}
		/>
	)
}

/** The field's own action: runs the search and closes the panel. Quiet while the field is empty. */
export function SearchButton({
	onClick,
	empty,
	small = false,
	className = "",
}: {
	onClick: () => void
	empty: boolean
	small?: boolean
	className?: string
}) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			className={`flex shrink-0 items-center gap-2 rounded-full font-bold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white ${small ? "h-10 px-3.5 text-[14px]" : "h-12 px-5 text-[15px]"} ${
				empty
					? "bg-white/[0.08] text-gray-300 hover:bg-white/[0.12]"
					: "bg-amber-400 text-gray-950 hover:bg-amber-300"
			} ${className}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
			Search
		</motion.button>
	)
}
