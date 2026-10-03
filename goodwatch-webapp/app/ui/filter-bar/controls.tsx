// The desktop row's controls. At the row's size (md) every control has a fixed width, so nothing shifts when a label or
// a count changes. The small size (sm, 36 px high) is for a strip that shares its line with other things, such as
// Watch next's: there a control is as wide as its words.
import {
	AdjustmentsHorizontalIcon,
	ArrowsUpDownIcon,
	CheckIcon,
	ChevronDownIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	PlusIcon,
} from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { type SortOption, compactCount } from "./labels"
import { Knob, MENU, SHELL, SPRING, TAP } from "./motion"
import { PROVIDER_LOGO, type StreamingProvider } from "./useFilterData"

/** Up to three service logos, overlapping. Grayed while the control is off. */
export function ServiceStack({
	providers,
	on,
	size = 20,
	max = 3,
}: {
	providers: Pick<StreamingProvider, "id" | "logo_path">[]
	on: boolean
	size?: number
	max?: number
}) {
	if (!providers.length) return null
	return (
		<span
			className="flex shrink-0 items-center"
			style={{ height: size }}
			aria-hidden
		>
			{providers.slice(0, max).map((p, i) => (
				<img
					key={p.id}
					src={`${PROVIDER_LOGO}${p.logo_path}`}
					alt=""
					style={{
						width: size,
						height: size,
						marginLeft: i ? -size * 0.32 : 0,
						zIndex: max - i,
					}}
					className={`relative rounded-[28%] object-cover ring-2 ring-gray-950 transition duration-300 ${on ? "" : "opacity-50 grayscale"}`}
				/>
			))}
		</span>
	)
}

/** Arrow keys move between a group's radios and pick, as in a native radio group. Put it on the group. */
export function radioKeys(
	event: KeyboardEvent<HTMLElement>,
	pick: (index: number) => void,
) {
	if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
		return
	event.preventDefault()
	const radios = Array.from(
		event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
	)
	const at = radios.indexOf(document.activeElement as HTMLElement)
	const forward = event.key === "ArrowRight" || event.key === "ArrowDown"
	const next = (at + (forward ? 1 : -1) + radios.length) % radios.length
	radios[next]?.focus()
	pick(next)
}

/**
 * On my services, with Everywhere one tap away: a radio group of two with a sliding lit panel. Without saved
 * services the first half reads "Add my services" and opens the services setting.
 */
export function ServicesControl({
	on,
	hasServices,
	providers,
	onChange,
	onAddServices,
	size = "md",
	labels,
	titles,
}: {
	on: boolean
	hasServices: boolean
	providers: Pick<StreamingProvider, "id" | "logo_path">[]
	onChange: (on: boolean) => void
	onAddServices: () => void
	size?: "md" | "sm"
	/** Other words for the two halves where room is short, for example "My services" and "All". */
	labels?: { mine?: string; everywhere?: string }
	/** A tooltip per half, for a surface where the choice means something else than hiding. */
	titles?: { mine?: string; everywhere?: string }
}) {
	const layoutId = useId()
	const sm = size === "sm"
	const seg = `relative z-10 flex h-full items-center justify-center gap-2 rounded-xl ${sm ? "px-2.5" : "px-3.5"} text-sm font-bold whitespace-nowrap cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400`
	const pickMine = () => (hasServices ? onChange(true) : onAddServices())
	return (
		<div
			role="radiogroup"
			aria-label="Where to watch"
			onKeyDown={(event) =>
				radioKeys(event, (index) =>
					index === 0 ? pickMine() : onChange(false),
				)
			}
			className={`relative flex shrink-0 ${sm ? "h-9 p-0.5" : "h-12 p-1"} ${SHELL}`}
		>
			<motion.button
				// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
				type="button"
				role="radio"
				aria-checked={on}
				tabIndex={on ? 0 : -1}
				whileTap={TAP}
				onClick={pickMine}
				title={titles?.mine}
				className={`${seg} ${sm ? "" : "w-48"} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{on && (
					<motion.span
						layoutId={layoutId}
						transition={SPRING}
						className="absolute inset-0 -z-10 rounded-xl bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]"
					/>
				)}
				{hasServices ? (
					<ServiceStack providers={providers} on={on} size={sm ? 18 : 20} />
				) : (
					<PlusIcon className="h-4 w-4 shrink-0" />
				)}
				{hasServices ? (labels?.mine ?? "On my services") : "Add my services"}
			</motion.button>
			<motion.button
				// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
				type="button"
				role="radio"
				aria-checked={!on}
				tabIndex={on ? -1 : 0}
				whileTap={TAP}
				onClick={() => onChange(false)}
				title={titles?.everywhere}
				className={`${seg} ${sm ? "" : "w-36"} ${!on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{!on && (
					<motion.span
						layoutId={layoutId}
						transition={SPRING}
						className="absolute inset-0 -z-10 rounded-xl bg-white/10 ring-1 ring-white/15"
					/>
				)}
				<GlobeAltIcon className="h-4 w-4 shrink-0" />
				{labels?.everywhere ?? "Everywhere"}
			</motion.button>
		</div>
	)
}

/** "−53", or "−1.2k" past a thousand, so the slot keeps its width. */
export const hiddenShort = (n: number) => `−${compactCount(n)}`

/**
 * Not seen yet: a labeled switch that says how many titles it hides (seen, and marked Not interested), when the
 * surface counts them.
 */
export function NotSeenSwitch({
	on,
	hides = null,
	onChange,
	size = "md",
	className = "",
}: {
	on: boolean
	hides?: number | null
	onChange: (on: boolean) => void
	size?: "md" | "sm"
	className?: string
}) {
	const shown = on && hides ? hides : 0
	const sm = size === "sm"
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={
				shown
					? `Not seen yet, hides ${shown.toLocaleString("en")} titles`
					: "Not seen yet"
			}
			whileTap={TAP}
			onClick={() => onChange(!on)}
			className={`relative flex shrink-0 items-center gap-2 text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${sm ? "h-9 px-3" : "h-12 w-56 px-3.5"} ${SHELL} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"} ${className}`}
		>
			{on ? (
				<EyeSlashIcon className="h-4 w-4 shrink-0 text-blue-400" />
			) : (
				<EyeIcon className="h-4 w-4 shrink-0" />
			)}
			<span className="flex-1 text-left">Not seen yet</span>
			{/* The small size has no fixed slot: the count shows only on a surface that counts. */}
			{(!sm || hides !== null) && (
				<span
					aria-hidden
					className={`w-9 shrink-0 text-right text-xs tabular-nums ${shown ? "text-blue-300/80" : "text-transparent"}`}
				>
					{hiddenShort(shown)}
				</span>
			)}
			<Knob
				on={on}
				onClass="bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,.6)]"
			/>
		</motion.button>
	)
}

/**
 * The sort choices as a menu of radio items, with arrow keys. Used in the desktop popover and the phone menu. A
 * disabled choice shows dimmed with its reason and can't be picked; `footer` goes under the list, for example the
 * sign-up prompt for a sort that needs taste. Each item carries `data-sort`.
 */
export function SortItems<K extends string>({
	options,
	value,
	onPick,
	dense = false,
	footnote,
	footer,
}: {
	options: SortOption<K>[]
	value: K
	onPick: (key: K) => void
	dense?: boolean
	footnote?: string
	footer?: ReactNode
}) {
	const layoutId = useId()
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
		event.preventDefault()
		const items = Array.from(
			event.currentTarget.querySelectorAll<HTMLElement>(
				'[role="menuitemradio"]',
			),
		)
		const at = items.indexOf(document.activeElement as HTMLElement)
		const next =
			event.key === "Home"
				? 0
				: event.key === "End"
					? items.length - 1
					: (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
						items.length
		items[next]?.focus()
	}
	return (
		<div className="flex flex-col" onKeyDown={onKeyDown}>
			{options.map((s) => {
				const on = s.key === value
				return (
					<motion.button
						key={s.key}
						type="button"
						role="menuitemradio"
						aria-checked={on}
						aria-disabled={s.disabled || undefined}
						data-checked={on || undefined}
						data-sort={s.key}
						whileTap={s.disabled ? undefined : TAP}
						onClick={() => !s.disabled && onPick(s.key)}
						className={`relative flex items-center gap-3 rounded-xl px-3 ${dense ? "py-2" : "py-2.5"} text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${s.disabled ? "cursor-default opacity-60" : "cursor-pointer"} ${on || s.disabled ? "" : "hover:bg-white/5"}`}
					>
						{on && (
							<motion.span
								layoutId={layoutId}
								transition={SPRING}
								className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10"
							/>
						)}
						<span className="relative min-w-0 flex-1">
							<span
								className={`block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}
							>
								{s.label}
							</span>
							<span className="block text-xs text-gray-500">{s.hint}</span>
						</span>
						{/* Amber marks what taste decides. */}
						<CheckIcon
							className={`relative h-4 w-4 shrink-0 ${s.taste ? "text-amber-400" : "text-white"} ${on ? "" : "invisible"}`}
						/>
					</motion.button>
				)
			})}
			{footnote && (
				<p className="px-3 pt-1.5 pb-2 text-xs text-gray-500">{footnote}</p>
			)}
			{footer}
		</div>
	)
}

/**
 * Focus and dismissal for a menu: focus moves to the checked item when it opens, Escape and Tab close it, Escape
 * returns focus to the trigger, and a press outside closes it.
 */
export function useMenu(
	open: boolean,
	close: () => void,
	root: React.RefObject<HTMLElement>,
	trigger: React.RefObject<HTMLElement>,
	outsideIgnore?: string,
) {
	const closeRef = useRef(close)
	closeRef.current = close
	useEffect(() => {
		if (!open) return
		const frame = requestAnimationFrame(() => {
			const menu = root.current?.querySelector<HTMLElement>('[role="menu"]')
			const item =
				menu?.querySelector<HTMLElement>("[data-checked]") ??
				menu?.querySelector<HTMLElement>('[role^="menuitem"]')
			item?.focus({ preventScroll: true })
		})
		const down = (event: Event) => {
			const target = event.target as HTMLElement
			if (root.current?.contains(target)) return
			// The trigger toggles the menu itself; it can sit outside the root when the menu is in a portal.
			if (trigger.current?.contains(target)) return
			if (outsideIgnore && target.closest(outsideIgnore)) return
			closeRef.current()
		}
		const key = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation()
				closeRef.current()
				trigger.current?.focus()
			} else if (event.key === "Tab") closeRef.current()
		}
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key, true)
		return () => {
			cancelAnimationFrame(frame)
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key, true)
		}
	}, [open, root, trigger, outsideIgnore])
}

// A menu in a portal closes once its button has scrolled this close to the top: under the site header.
const PORTAL_MIN_BOTTOM = 60

/**
 * The sort button and its popover. The label rolls when the sort changes; the icon is amber while taste decides the
 * sort (Best match).
 * - `size`: md is the row's fixed-width button; sm is 36 px high and as wide as its words.
 * - `align`: which edge of the button the menu hangs from.
 * - `portal`: the menu renders in the body with fixed positioning and follows the button, for a strip that pins or
 *   clips (Watch next's).
 * - `open` and `onOpenChange` let the surface open the menu, as For you does under Best match; without them the
 *   control keeps its own state. `outsideIgnore` names elements whose press doesn't close it.
 */
export function SortControl<K extends string>({
	options,
	value,
	onChange,
	footnote,
	footer,
	size = "md",
	align = "left",
	portal = false,
	menuClassName = "w-72",
	open: openProp,
	onOpenChange,
	outsideIgnore,
}: {
	options: SortOption<K>[]
	value: K
	onChange: (key: K) => void
	footnote?: string
	footer?: ReactNode
	size?: "md" | "sm"
	align?: "left" | "right"
	portal?: boolean
	/** The menu's width. */
	menuClassName?: string
	open?: boolean
	onOpenChange?: (open: boolean) => void
	outsideIgnore?: string
}) {
	const [openState, setOpenState] = useState(false)
	const open = openProp ?? openState
	const setOpen = (next: boolean) => {
		setOpenState(next)
		onOpenChange?.(next)
	}
	const close = useRef(() => setOpen(false))
	close.current = () => setOpen(false)
	const root = useRef<HTMLDivElement>(null)
	const portalRoot = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	const menuId = useId()
	const [box, setBox] = useState<{
		top: number
		left?: number
		right?: number
	} | null>(null)
	useMenu(
		open && (!portal || box !== null),
		() => setOpen(false),
		portal ? portalRoot : root,
		trigger,
		outsideIgnore,
	)
	// In a portal the menu follows its button as the page scrolls, and closes once the button is gone.
	useLayoutEffect(() => {
		if (!open || !portal) return
		const place = () => {
			const r = trigger.current?.getBoundingClientRect()
			if (!r) return
			if (r.bottom < PORTAL_MIN_BOTTOM) return close.current()
			setBox(
				align === "right"
					? {
							top: r.bottom + 8,
							right: Math.max(8, window.innerWidth - r.right),
						}
					: { top: r.bottom + 8, left: Math.max(8, r.left) },
			)
		}
		place()
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => {
			window.removeEventListener("scroll", place)
			window.removeEventListener("resize", place)
		}
	}, [open, portal, align])

	const chosen = options.find((s) => s.key === value)
	const label = chosen?.label ?? ""
	const sm = size === "sm"
	const menu = (
		<AnimatePresence>
			{open && (!portal || box) && (
				<motion.div
					id={menuId}
					role="menu"
					aria-label="Sort"
					initial={{ opacity: 0, y: -6, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -4, scale: 0.98 }}
					transition={{ duration: 0.16 }}
					style={portal && box ? box : undefined}
					className={`${portal ? "fixed z-[70]" : `absolute z-40 mt-2 ${align === "right" ? "right-0" : "left-0"}`} ${menuClassName} max-w-[calc(100vw-1.5rem)] ${align === "right" ? "origin-top-right" : "origin-top-left"} p-1.5 ${MENU}`}
				>
					<SortItems
						options={options}
						value={value}
						footnote={footnote}
						footer={footer}
						onPick={(key) => {
							onChange(key)
							setOpen(false)
							trigger.current?.focus()
						}}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	)
	return (
		<div ref={root} className="relative shrink-0">
			<motion.button
				ref={trigger}
				type="button"
				whileTap={TAP}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				aria-label={`Sort: ${label}`}
				data-sort-button
				onClick={() => setOpen(!open)}
				onKeyDown={(event) => {
					if (open) return
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault()
						setOpen(true)
					}
				}}
				className={`flex items-center text-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${sm ? "h-9 gap-1.5 px-3 whitespace-nowrap" : "h-12 w-52 gap-2 px-4"} ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}
			>
				<ArrowsUpDownIcon
					className={`h-4 w-4 shrink-0 ${chosen?.taste ? "text-amber-400" : "text-gray-400"}`}
				/>
				<span className="text-gray-400">Sort</span>
				<span
					className={`relative overflow-hidden text-left ${sm ? "" : "flex-1"}`}
				>
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={value}
							initial={{ y: 14, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -14, opacity: 0 }}
							transition={SPRING}
							className={`block font-bold text-white ${sm ? "" : "truncate"}`}
						>
							{label}
						</motion.span>
					</AnimatePresence>
				</span>
				<ChevronDownIcon
					className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</motion.button>
			{portal
				? typeof document !== "undefined" &&
					createPortal(<div ref={portalRoot}>{menu}</div>, document.body)
				: menu}
		</div>
	)
}

/** Opens the Filters sheet; the badge counts the active filters inside it. */
// The most active filters the Filters button's tooltip names; the rest are "+N more".
const MAX_SUMMARY = 8

export function FiltersButton({
	count,
	onClick,
	expanded,
	summary = [],
	children,
}: {
	count: number
	onClick: () => void
	expanded: boolean
	/** The active filters' labels: on hover or focus a tooltip lists them. */
	summary?: string[]
	children?: ReactNode
}) {
	const tooltipId = useId()
	const tooltip = summary.length > 0 && !expanded
	return (
		<span className="group/filters relative flex shrink-0">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onClick}
				aria-haspopup="dialog"
				aria-expanded={expanded}
				aria-label={count ? `Filters, ${count} active` : "Filters"}
				aria-describedby={tooltip ? tooltipId : undefined}
				className={`flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-bold text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} hover:ring-white/25`}
			>
				<AdjustmentsHorizontalIcon className="h-4 w-4" />
				{children ?? "Filters"}
				<span
					aria-hidden
					className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs tabular-nums ${count ? "bg-amber-500 text-gray-950" : "bg-white/10 text-gray-400"}`}
				>
					{count}
				</span>
			</motion.button>
			{tooltip && (
				<span
					id={tooltipId}
					role="tooltip"
					className={`pointer-events-none absolute top-full right-0 z-50 mt-2 hidden w-max max-w-64 flex-col gap-1 px-3.5 py-3 text-sm group-hover/filters:flex group-focus-within/filters:flex ${MENU}`}
				>
					<span className="text-xs font-bold tracking-wide text-gray-400 uppercase">
						Active filters
					</span>
					{summary.slice(0, MAX_SUMMARY).map((label, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: labels can repeat; the list is static
						<span key={i} className="truncate">
							{label}
						</span>
					))}
					{summary.length > MAX_SUMMARY && (
						<span className="text-gray-500">
							+{summary.length - MAX_SUMMARY} more
						</span>
					)}
				</span>
			)}
		</span>
	)
}
