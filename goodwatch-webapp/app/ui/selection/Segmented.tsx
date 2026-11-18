// The pill group for a choice that filters the page's whole list (D2's solid white): a white 6% track, the picked
// option a white pill with near-black text and its count dimmed. With `onChange` the options are ARIA radios; without
// it each option is a link to its own address (`href`), marked with aria-current.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { SELECTED_SOLID } from "./selected"

export interface SegmentedOption<T extends string> {
	key: T
	label: ReactNode
	count?: number
	/** The option's address, when the options are links. */
	href?: string
}

type Common<T extends string> = {
	/** The group's name for screen readers. */
	label: string
	options: SegmentedOption<T>[]
	value: T
	/** `md` is 36px tall, `sm` 32px. */
	size?: "sm" | "md"
	/** Layout only. */
	className?: string
}

const TRACK =
	"flex max-w-full gap-1 overflow-x-auto rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 [scrollbar-width:none]"
const OPTION =
	"flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400"

function Content({ option, on }: { option: SegmentedOption<string>; on: boolean }) {
	return (
		<>
			{option.label}
			{option.count != null && (
				<span className={`text-xs tabular-nums ${on ? "text-gray-950/60" : "text-gray-400"}`}>
					{option.count.toLocaleString("en-US")}
				</span>
			)}
		</>
	)
}

/**
 * Radios: `onChange` picks an option. Links: each option has an `href`; `replace` replaces the history entry and keeps
 * the scroll, for options that re-show the same list.
 */
export function Segmented<T extends string>(
	props: Common<T> & ({ onChange: (key: T) => void } | { onChange?: never; replace?: boolean }),
) {
	const { label, options, value, size = "md", className = "" } = props
	const look = (on: boolean) =>
		`${OPTION} ${size === "sm" ? "h-8" : "h-9"} ${on ? SELECTED_SOLID : "text-gray-300 hover:bg-white/10 hover:text-white"}`

	if (props.onChange) {
		const { onChange } = props
		return (
			<div role="radiogroup" aria-label={label} className={`${TRACK} ${className}`}>
				{options.map((option) => (
					<button
						key={option.key}
						type="button"
						// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA radio pattern on styled buttons, with aria-checked
						role="radio"
						aria-checked={option.key === value}
						onClick={() => onChange(option.key)}
						className={look(option.key === value)}
					>
						<Content option={option} on={option.key === value} />
					</button>
				))}
			</div>
		)
	}

	const replace = "replace" in props && props.replace
	return (
		<nav aria-label={label} className={`${TRACK} ${className}`}>
			{options.map((option) => (
				<Link
					key={option.key}
					to={option.href ?? ""}
					replace={replace}
					preventScrollReset={replace}
					prefetch="intent"
					aria-current={option.key === value ? "page" : undefined}
					className={look(option.key === value)}
				>
					<Content option={option} on={option.key === value} />
				</Link>
			))}
		</nav>
	)
}
