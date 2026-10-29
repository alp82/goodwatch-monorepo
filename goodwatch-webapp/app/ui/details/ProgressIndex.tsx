// "On this page": one entry per section with its icon, its name, a muted gist, and a thin line that fills as the
// section is read (written by useReading). Every section on screen is highlighted, not just one.
import type { ComponentType } from "react"

export interface IndexItem {
	/** The section's element id on the page. */
	id: string
	label: string
	icon: ComponentType<{ className?: string }>
	/** The muted second line (the section's gist). */
	peek?: string | null
}

/** A line that fills as section `id` is read (transform only). */
function ReadProgress({
	id,
	className = "",
}: { id: string; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={`block h-0.5 overflow-hidden rounded-full bg-white/[.06] ${className}`}
		>
			<span
				data-read-progress={id}
				className="block h-full origin-left bg-amber-500/70"
				style={{ transform: "scaleX(0)" }}
			/>
		</span>
	)
}

function IndexEntry({
	item,
	on,
	onJump,
}: { item: IndexItem; on: boolean; onJump: (id: string) => void }) {
	const Icon = item.icon
	return (
		<button
			type="button"
			aria-current={on ? "location" : undefined}
			onClick={() => onJump(item.id)}
			className={`group flex w-full cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ${
				on
					? "bg-white/[.06] text-white"
					: "text-gray-400 hover:bg-white/[.03] hover:text-gray-100"
			}`}
		>
			<Icon
				className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-amber-400" : "text-gray-500 group-hover:text-gray-300"}`}
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-medium">{item.label}</span>
				{item.peek && (
					<span className="mt-0.5 block truncate text-xs text-gray-500">
						{item.peek}
					</span>
				)}
				<ReadProgress id={item.id} className="mt-1.5" />
			</span>
		</button>
	)
}

/** The whole index. `visible` comes from useReading. */
export function ProgressIndex({
	items,
	visible,
	onJump,
}: {
	items: IndexItem[]
	visible: string[]
	onJump: (id: string) => void
}) {
	return (
		<nav aria-label="On this page">
			<ul className="flex flex-col gap-0.5">
				{items.map((item) => (
					<li key={item.id}>
						<IndexEntry
							item={item}
							on={visible.includes(item.id)}
							onJump={onJump}
						/>
					</li>
				))}
			</ul>
		</nav>
	)
}
