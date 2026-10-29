// One of Your lists as a switch: NotSeenSwitch's look at its small size (the shell, an icon, the label, what it hides,
// the blue knob), plus an amber outline while on and a lock in place of the icon for guests. NotSeenSwitch itself is
// tied to its own label and eye icons and has no lock, so the pill shares its classes instead.
import {
	EyeIcon,
	EyeSlashIcon,
	LockClosedIcon,
} from "@heroicons/react/20/solid"
import { BookmarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { hiddenShort } from "~/ui/filter-bar/controls"
import { Knob, SHELL, TAP } from "~/ui/filter-bar/motion"
import type { ListId } from "./you-choices"

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

function ListIcon({ id }: { id: ListId }) {
	const className = "h-4 w-4 shrink-0"
	if (id === "notSeenYet")
		return <EyeSlashIcon className={`${className} text-blue-400`} aria-hidden />
	if (id === "seenBefore")
		return <EyeIcon className={`${className} text-emerald-400`} aria-hidden />
	return <BookmarkIcon className={`${className} text-amber-400`} aria-hidden />
}

export function ListPill({
	id,
	label,
	on,
	hides,
	onChange,
	locked,
}: {
	id: ListId
	label: string
	on: boolean
	/** What the switch hides from this list; null shows no count. */
	hides: number | null
	onChange: (on: boolean) => void
	/** Guests: faint, with a lock, no count. */
	locked: boolean
}) {
	const lit = on && !locked
	const count = locked ? null : hides
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={lit}
			aria-label={
				lit && count
					? `${label}, hides ${count.toLocaleString("en")} titles`
					: label
			}
			disabled={locked}
			whileTap={locked ? undefined : TAP}
			onClick={() => onChange(!on)}
			data-list={id}
			className={`relative flex h-9 w-full min-w-0 items-center gap-2 px-3 text-sm font-bold whitespace-nowrap transition-colors ${FOCUS} ${SHELL} ${
				locked
					? "cursor-default text-gray-600"
					: lit
						? "cursor-pointer text-white"
						: "cursor-pointer text-gray-400 hover:text-gray-200"
			}`}
		>
			<span
				aria-hidden
				className={`pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-amber-400/70 transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`}
			/>
			{locked ? (
				<LockClosedIcon
					className="h-3.5 w-3.5 shrink-0 text-amber-500/70"
					aria-hidden
				/>
			) : (
				<ListIcon id={id} />
			)}
			<span className="min-w-0 flex-1 truncate text-left">{label}</span>
			{count !== null && (
				<span
					aria-hidden
					className={`shrink-0 text-right text-xs tabular-nums transition-colors ${lit ? "text-blue-300/80" : "text-gray-500"}`}
				>
					{hiddenShort(count)}
				</span>
			)}
			<Knob
				on={lit}
				onClass="bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,.6)]"
			/>
		</motion.button>
	)
}
