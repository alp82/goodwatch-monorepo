// PROTOTYPE - throwaway. The pieces round 6's Sides of you variants share: the sides model with the services
// switch, round 2's contradiction hero, the side's attribute chips, and the "just past it" words for an edge.
// Variants own their layout.
import { useMemo, useState } from "react"
import {
	PickRow,
	ServicesSwitch,
	YourScore,
	attrOf,
	useOnMine,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Ref, Title } from "~/ui/prototype-rec-taste-2/model"
import { Fan } from "~/ui/prototype-rec-taste-4/parts"
import type { Edge, Payload6, SideView, SidesModel } from "./model"
import { buildSides, pct } from "./model"

export type VariantProps = { data: Payload6 }

export function useSides(data: Payload6) {
	const model = useMemo(() => buildSides(data), [data])
	const first =
		[...model.sides].sort((x, y) => y.avg - x.avg)[0]?.id ?? model.sides[0]?.id
	const [id, setId] = useState(first)
	const side = model.sides.find((s) => s.id === id) ?? model.sides[0]
	const services = useOnMine(data)
	return { model, side, select: setId, services }
}

export type Services = ReturnType<typeof useOnMine>

export const bd = (t: Title | null | undefined, size: "w780" | "w1280" = "w1280") =>
	t?.backdrop ? t.backdrop.replace("/w1280/", `/${size}/`) : undefined

/** Round 2's hero: the two sides furthest apart, fanned out on either side of the sentence. */
export function Contradiction({
	model,
	onPick,
	compact = false,
}: {
	model: SidesModel
	onPick?: (id: string) => void
	compact?: boolean
}) {
	const c = model.contradiction
	if (!c) return null
	const { a, b } = c
	return (
		<section className="relative overflow-hidden border-b border-gray-800 bg-gray-950">
			<div
				className={`mx-auto grid max-w-7xl items-center gap-6 px-4 md:grid-cols-[1fr_1.3fr_1fr] md:gap-8 md:px-8 ${compact ? "py-8 md:py-10" : "py-10 md:py-16"}`}
			>
				<Fan
					items={a.loved}
					dir={-1}
					label={`Open ${a.name}`}
					onPick={() => onPick?.(a.id)}
				/>
				<div className="text-center">
					<p className="text-sm text-gray-400">The contradiction in your taste</p>
					<h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
						You love <span className="text-amber-300">{a.name.toLowerCase()}</span>
					</h1>
					<p className="my-3 text-xl text-gray-400 md:text-2xl">and also</p>
					<p className="text-3xl font-bold leading-tight md:text-5xl">
						<span className="text-sky-300">{b.name.toLowerCase()}</span>
					</p>
					<p className="mx-auto mt-5 max-w-md text-gray-400">
						Most people's favorites sit close together. Yours are {pct(a.share)} one
						thing and {pct(b.share)} its opposite.
					</p>
				</div>
				<Fan
					items={b.loved}
					dir={1}
					label={`Open ${b.name}`}
					onPick={() => onPick?.(b.id)}
				/>
			</div>
		</section>
	)
}

/** Your average on a side and the attributes that hold it together, as round 2 showed them. */
export function SideChips({
	data,
	side,
	className = "",
}: { data: Payload6; side: SideView; className?: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-2 md:gap-3 ${className}`}>
			<YourScore score={Math.round(side.avg)} label={`Your average here: ${side.avg}`} />
			{side.attrs.map((k) => {
				const at = attrOf(data, k)
				if (!at) return null
				return (
					<span
						key={k}
						className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-sm"
					>
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ background: at.color.replace(/[\d.]+\)$/, "1)") }}
						/>
						{at.label}
					</span>
				)
			})}
		</div>
	)
}

/** "You've barely been to South Korea, and you rate it 7.9." */
export function edgeSentence(e: Edge) {
	return `${e.pre} ${e.object}`
}
export function edgeRating(e: Edge, usual: number) {
	return e.avg != null
		? `When you go, you rate it ${e.avg}. Usually you give ${usual}.`
		: `You've rated ${e.rated.length} here.`
}

/** An edge's picks: on the person's services first, then, if too few, from everywhere, so the edge never
 * looks empty. Everywhere mode keeps the plain order. */
export function edgePicks(services: Services, refs: Ref[], n: number) {
	const mine = services.filter(refs)
	if (!services.onlyMine || mine.length >= n) return mine.slice(0, n)
	const rest = refs.filter((r) => !mine.includes(r))
	return [...mine, ...rest].slice(0, n)
}

/** A heading with the services switch on the right, and the picks under it. */
export function Picks({
	data,
	services,
	refs,
	title,
	n = 6,
	cols,
	className = "",
	switchable = true,
}: {
	data: Payload6
	services: Services
	refs: Parameters<Services["filter"]>[0]
	title: string
	n?: number
	cols?: string
	className?: string
	switchable?: boolean
}) {
	return (
		<div className={className}>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<h3 className="text-xl font-bold">{title}</h3>
				{switchable && <ServicesSwitch state={services} />}
			</div>
			<PickRow data={data} refs={services.filter(refs)} n={n} cols={cols} />
		</div>
	)
}

export function Empty() {
	return (
		<p className="mx-auto max-w-7xl px-4 py-16 text-lg text-gray-300 md:px-8">
			Rate a few more titles you love to see the sides of your taste.
		</p>
	)
}
