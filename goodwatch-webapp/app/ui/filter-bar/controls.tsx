// The desktop row's controls. Every control has a fixed width, so nothing shifts when a label or a count changes.
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
	useRef,
	useState,
} from "react"
import type { SortOption } from "./labels"
import { Knob, MENU, SHELL, SPRING, TAP } from "./motion"
import { PROVIDER_LOGO, type StreamingProvider } from "./useFilterData"

/** Up to three service logos, overlapping. Grayed while the control is off. */
export function ServiceStack({
	providers,
	on,
	size = 20,
	max = 3,
}: {
	providers: StreamingProvider[]
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
}: {
	on: boolean
	hasServices: boolean
	providers: StreamingProvider[]
	onChange: (on: boolean) => void
	onAddServices: () => void
}) {
	const layoutId = useId()
	const seg =
		"relative z-10 flex h-full items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
			className={`relative flex h-12 shrink-0 p-1 ${SHELL}`}
		>
			<motion.button
				// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
				type="button"
				role="radio"
				aria-checked={on}
				tabIndex={on ? 0 : -1}
				whileTap={TAP}
				onClick={pickMine}
				className={`${seg} w-48 ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{on && (
					<motion.span
						layoutId={layoutId}
						transition={SPRING}
						className="absolute inset-0 -z-10 rounded-xl bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]"
					/>
				)}
				{hasServices ? (
					<ServiceStack providers={providers} on={on} />
				) : (
					<PlusIcon className="h-4 w-4 shrink-0" />
				)}
				{hasServices ? "On my services" : "Add my services"}
			</motion.button>
			<motion.button
				// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
				type="button"
				role="radio"
				aria-checked={!on}
				tabIndex={on ? -1 : 0}
				whileTap={TAP}
				onClick={() => onChange(false)}
				className={`${seg} w-36 ${!on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{!on && (
					<motion.span
						layoutId={layoutId}
						transition={SPRING}
						className="absolute inset-0 -z-10 rounded-xl bg-white/10 ring-1 ring-white/15"
					/>
				)}
				<GlobeAltIcon className="h-4 w-4 shrink-0" />
				Everywhere
			</motion.button>
		</div>
	)
}

/** "−53", or "−1.2k" past a thousand, so the slot keeps its width. */
export const hiddenShort = (n: number) =>
	n >= 1000 ? `−${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `−${n}`

/** Not seen yet: a labeled switch that says how many titles it hides (seen, and marked Not interested). */
export function NotSeenSwitch({
	on,
	hides,
	onChange,
}: {
	on: boolean
	hides: number | null
	onChange: (on: boolean) => void
}) {
	const shown = on && hides ? hides : 0
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={
				shown ? `Not seen yet, hides ${shown} titles` : "Not seen yet"
			}
			whileTap={TAP}
			onClick={() => onChange(!on)}
			className={`relative flex h-12 w-56 shrink-0 items-center gap-2 px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
		>
			{on ? (
				<EyeSlashIcon className="h-4 w-4 shrink-0 text-blue-400" />
			) : (
				<EyeIcon className="h-4 w-4 shrink-0" />
			)}
			<span className="flex-1 text-left">Not seen yet</span>
			<span
				aria-hidden
				className={`w-9 shrink-0 text-right text-xs tabular-nums ${shown ? "text-blue-300/80" : "text-transparent"}`}
			>
				{hiddenShort(shown)}
			</span>
			<Knob
				on={on}
				onClass="bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,.6)]"
			/>
		</motion.button>
	)
}

/** The sort choices as a menu of radio items, with arrow keys. Used in the desktop popover and the phone menu. */
export function SortItems<K extends string>({
	options,
	value,
	onPick,
	dense = false,
	footnote,
}: {
	options: SortOption<K>[]
	value: K
	onPick: (key: K) => void
	dense?: boolean
	footnote?: string
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
						data-checked={on || undefined}
						whileTap={TAP}
						onClick={() => onPick(s.key)}
						className={`relative flex items-center gap-3 rounded-xl px-3 ${dense ? "py-2" : "py-2.5"} text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "" : "hover:bg-white/5"}`}
					>
						{on && (
							<motion.span
								layoutId={layoutId}
								transition={SPRING}
								className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10"
							/>
						)}
						<span className="relative flex-1">
							<span
								className={`block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}
							>
								{s.label}
							</span>
							<span className="block text-xs text-gray-500">{s.hint}</span>
						</span>
						<CheckIcon
							className={`relative h-4 w-4 text-white ${on ? "" : "invisible"}`}
						/>
					</motion.button>
				)
			})}
			{footnote && (
				<p className="px-3 pt-1.5 pb-2 text-xs text-gray-500">{footnote}</p>
			)}
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

/** The fixed-width sort button and its popover. The label rolls when the sort changes. */
export function SortControl<K extends string>({
	options,
	value,
	onChange,
	footnote,
}: {
	options: SortOption<K>[]
	value: K
	onChange: (key: K) => void
	footnote?: string
}) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	const menuId = useId()
	useMenu(open, () => setOpen(false), root, trigger)
	const label = options.find((s) => s.key === value)?.label ?? ""
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
				onClick={() => setOpen((o) => !o)}
				className={`flex h-12 w-52 items-center gap-2 px-4 text-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}
			>
				<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
				<span className="text-gray-400">Sort</span>
				<span className="relative flex-1 overflow-hidden text-left">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={value}
							initial={{ y: 14, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -14, opacity: 0 }}
							transition={SPRING}
							className="block truncate font-bold text-white"
						>
							{label}
						</motion.span>
					</AnimatePresence>
				</span>
				<ChevronDownIcon
					className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</motion.button>
			<AnimatePresence>
				{open && (
					<motion.div
						id={menuId}
						role="menu"
						aria-label="Sort"
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						className={`absolute left-0 z-40 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-left p-1.5 ${MENU}`}
					>
						<SortItems
							options={options}
							value={value}
							footnote={footnote}
							onPick={(key) => {
								onChange(key)
								setOpen(false)
								trigger.current?.focus()
							}}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/** Opens the Filters sheet; the badge counts the active filters inside it. */
export function FiltersButton({
	count,
	onClick,
	expanded,
	children,
}: {
	count: number
	onClick: () => void
	expanded: boolean
	children?: ReactNode
}) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-expanded={expanded}
			aria-label={count ? `Filters, ${count} active` : "Filters"}
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
	)
}
