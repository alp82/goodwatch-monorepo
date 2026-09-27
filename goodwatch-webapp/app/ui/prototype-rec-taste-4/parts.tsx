// PROTOTYPE - throwaway. The few pieces round 4's third-view candidates share, cut from round 2's Sides
// so every candidate reads as its sibling: the poster fan, the backdrop tab and the pill.
import type { ReactNode } from "react"
import type { Title } from "~/ui/prototype-rec-taste-2/model"

/** Three posters fanned out, as in the Sides hero. dir -1 fans left, 1 fans right. */
export function Fan({
	items,
	dir,
	onPick,
	label,
}: {
	items: Title[]
	dir: 1 | -1
	onPick?: () => void
	label: string
}) {
	const shown = items.filter((t) => t.poster).slice(0, 3)
	return (
		<button
			type="button"
			onClick={onPick}
			className="relative mx-auto h-40 w-56 md:h-72 md:w-full"
			aria-label={label}
		>
			{shown.map((t, i) => (
				<img
					key={t.key}
					src={t.poster}
					alt={t.title}
					className="absolute top-1/2 w-24 rounded-lg border-4 border-gray-800 shadow-2xl md:w-40"
					style={{
						left: `calc(50% + ${(i - 1) * 44 * dir}px)`,
						transform: `translate(-50%, -50%) rotate(${(i - 1) * 8 * dir}deg)`,
						zIndex: dir === 1 ? 3 - i : i,
					}}
				/>
			))}
		</button>
	)
}

/** A tab with a faint backdrop, as the side tabs in Sides. */
export function BackdropTab({
	on,
	onClick,
	backdrop,
	title,
	sub,
}: {
	on: boolean
	onClick: () => void
	backdrop?: string
	title: ReactNode
	sub: ReactNode
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={on}
			onClick={onClick}
			className={`relative isolate overflow-hidden rounded-xl border-2 p-4 text-left transition ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-950/60 hover:border-gray-600"}`}
		>
			{backdrop && (
				<img
					src={backdrop.replace("/w1280/", "/w780/")}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20"
				/>
			)}
			<span className="block text-lg font-bold leading-tight">{title}</span>
			<span className="mt-2 block text-sm text-gray-300">{sub}</span>
		</button>
	)
}

/** A pill, as the mood pills in Sides. */
export function Pill({
	on,
	onClick,
	children,
}: { on: boolean; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${on ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
		>
			{children}
		</button>
	)
}

export const fewRatings = (n: number) =>
	n >= 1000
		? `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k ratings`
		: `${n} ratings`

export const article = (n: number) => (n === 8 ? "an" : "a")

export const NUMBER_WORDS = [
	"No",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
]
