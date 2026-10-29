// The title page's small shared look: the section header, a caption sub-heading, the contained list and its rows, a
// search field, filter chips with live counts, the "Show N more" row, keyboard keys, and an in-place reveal.
import {
	CheckIcon,
	LinkIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline"
import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"

/** Small caps caption (sub-headings, rail labels). */
export const CAPTION =
	"text-[11px] font-semibold uppercase tracking-[.14em] text-gray-500"
/** A contained list: rows with hairlines between, on a faint card. Use with rows of h-12 or more. */
export const LIST =
	"divide-y divide-white/[0.07] overflow-hidden rounded-xl bg-white/[0.025] ring-1 ring-white/10"
/** A full-width pressable row inside LIST: hover and pressed states and a focus ring. */
export const ROW =
	"group flex w-full cursor-pointer items-center gap-3 px-3 text-left transition-colors duration-150 hover:bg-white/[0.05] active:bg-white/[0.08] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300"

export const fmt = (n: number) => n.toLocaleString("en-US")

/** Initials for a person without a photo. */
export const initials = (name: string) =>
	name
		.split(/\s+/)
		.map((w) => w[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")

export function Kbd({ children }: { children: ReactNode }) {
	return (
		<kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-white/15 bg-white/[0.04] px-1 font-sans text-[10px] font-semibold text-gray-400">
			{children}
		</kbd>
	)
}

/**
 * One header for every section: icon tile, name, an optional muted line, a copy-link mark that shows on hover
 * (always faintly on a phone), and an `aside` slot at the right for the section's own controls.
 * `anchor` is the section element's id: the heading gets `${anchor}-h` (for aria-labelledby).
 */
export function SectionHeader({
	anchor,
	icon: Icon,
	title,
	subtitle,
	aside,
}: {
	anchor: string
	icon: ComponentType<{ className?: string }>
	title: string
	subtitle?: ReactNode
	aside?: ReactNode
}) {
	const [copied, setCopied] = useState(false)
	const copy = async () => {
		const url = new URL(window.location.href)
		url.hash = anchor
		window.history.replaceState(window.history.state, "", url)
		try {
			await navigator.clipboard.writeText(url.toString())
		} catch {}
		setCopied(true)
		window.setTimeout(() => setCopied(false), 1600)
	}
	return (
		<header className="group/h flex items-center gap-3">
			<span
				aria-hidden="true"
				className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-amber-300/90 ring-1 ring-white/10"
			>
				<Icon className="h-5 w-5" />
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					<h2
						id={`${anchor}-h`}
						className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
					>
						{title}
					</h2>
					<button
						type="button"
						onClick={copy}
						aria-label={`Copy a link to ${title}`}
						title="Copy link"
						className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs transition-opacity duration-150 focus-visible:opacity-100 ${
							copied
								? "text-emerald-300 opacity-100"
								: "text-gray-500 opacity-0 hover:text-amber-300 group-hover/h:opacity-100 max-lg:opacity-40"
						}`}
					>
						{copied ? (
							<CheckIcon className="h-4 w-4" />
						) : (
							<LinkIcon className="h-4 w-4" />
						)}
						{copied && <span>Copied</span>}
					</button>
				</div>
				{subtitle && (
					<p className="mt-0.5 line-clamp-2 text-sm text-gray-400">
						{subtitle}
					</p>
				)}
			</div>
			{aside}
		</header>
	)
}

/** A sub-heading inside a section: caption words and an optional muted count or note after them. */
export function SubHeading({
	children,
	note,
	id,
}: { children: ReactNode; note?: ReactNode; id?: string }) {
	return (
		<h3 id={id} className={`${CAPTION} mb-3`}>
			{children}
			{note != null && (
				<span className="normal-case tracking-normal text-gray-600">
					{" "}
					· {note}
				</span>
			)}
		</h3>
	)
}

/** A search field with a clear button. `busy` shows a quiet spinner while the server answers. */
export function SearchField({
	value,
	onChange,
	placeholder,
	label,
	busy = false,
	className = "",
}: {
	value: string
	onChange: (value: string) => void
	placeholder: string
	label: string
	busy?: boolean
	className?: string
}) {
	return (
		<div className={`relative ${className}`}>
			<MagnifyingGlassIcon
				aria-hidden="true"
				className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
			/>
			<input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape" && value) {
						e.preventDefault()
						onChange("")
					}
				}}
				placeholder={placeholder}
				aria-label={label}
				className="h-10 w-full rounded-lg bg-white/[0.04] pl-9 pr-9 text-sm text-white ring-1 ring-white/10 placeholder:text-gray-500 hover:ring-white/20 focus:bg-white/[0.06] focus:outline-none focus:ring-amber-300/60 [&::-webkit-search-cancel-button]:hidden"
			/>
			{busy ? (
				<span
					aria-hidden="true"
					className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-white/15 border-t-amber-300"
				/>
			) : value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear"
					className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			) : null}
		</div>
	)
}

export interface Chip {
	key: string
	label: string
	count?: number
}

/**
 * One-of filter chips with live counts ("Main cast 35"). A chip with no matches stays visible but quiet. Wraps on a
 * phone (no sideways scroll), so every option is seen at once.
 */
export function FilterChips({
	chips,
	value,
	onChange,
	label,
	className = "",
}: {
	chips: Chip[]
	value: string
	onChange: (key: string) => void
	label: string
	className?: string
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: a row of toggle buttons, not a form; a <fieldset> would need a legend
		<div
			role="group"
			aria-label={label}
			className={`flex flex-wrap gap-1.5 ${className}`}
		>
			{chips.map((c) => {
				const on = c.key === value
				const empty = c.count === 0 && !on
				return (
					<button
						key={c.key}
						type="button"
						aria-pressed={on}
						onClick={() => onChange(c.key)}
						className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors duration-150 ${
							on
								? "bg-white font-semibold text-black"
								: empty
									? "text-gray-600 ring-1 ring-white/[0.06] hover:text-gray-400"
									: "text-gray-200 ring-1 ring-white/15 hover:bg-white/[0.06] hover:text-white"
						}`}
					>
						{c.label}
						{c.count != null && (
							<span
								className={`tabular-nums text-xs ${on ? "text-black/55" : empty ? "text-gray-700" : "text-gray-500"}`}
							>
								{fmt(c.count)}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/** The quiet full-width "Show N more" row under a list; `busy` while the next part loads. */
export function MoreRow({
	children,
	onClick,
	busy = false,
	className = "",
}: {
	children: ReactNode
	onClick: () => void
	busy?: boolean
	className?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy}
			className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/[0.04] text-sm font-semibold text-gray-200 ring-1 ring-white/10 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white active:bg-white/[0.1] disabled:cursor-wait ${className}`}
		>
			{busy && (
				<span
					aria-hidden="true"
					className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-amber-300"
				/>
			)}
			{children}
		</button>
	)
}

/** Fades and lifts its content in when it mounts (opacity and transform only), for things that open in place. */
export function Reveal({
	children,
	className = "",
}: { children: ReactNode; className?: string }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		ref.current?.animate(
			[
				{ opacity: 0, transform: "translateY(6px)" },
				{ opacity: 1, transform: "none" },
			],
			{ duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" },
		)
	}, [])
	return (
		<div ref={ref} className={className}>
			{children}
		</div>
	)
}
