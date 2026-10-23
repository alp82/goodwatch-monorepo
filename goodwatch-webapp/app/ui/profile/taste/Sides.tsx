// "Sides of them": the taste groups of the owner's /taste page. Each side: its name, what sets it apart, its typical
// titles as a fanned stack, how many and how well scored; picking a side shows where they are in it.
import { useState } from "react"
import { PosterImg } from "../parts"
import { FAMILY_COLOR, useTaste } from "./model"
import { MiniPoster, PANEL, SectionHead } from "./parts"

export function Sides() {
	const { taste: t, owner, attributeByKey, title: tt } = useTaste()
	const taste = { sides: t.sides.list, sidesHeadline: t.sides.headline }
	const [open, setOpen] = useState(taste.sides[0]?.id)
	const total = taste.sides.reduce((s, x) => s + x.count, 0)
	const side = taste.sides.find((s) => s.id === open) ?? taste.sides[0]
	// The two sides least alike, as on the real Taste page.
	const first = taste.sides.find((s) => s.id === taste.sidesHeadline?.first)
	const last = taste.sides.find((s) => s.id === taste.sidesHeadline?.second)
	if (!taste.sides.length) return null
	return (
		<section aria-labelledby="sides" className="flex flex-col gap-5">
			<SectionHead
				id="sides"
				eyebrow="Taste groups"
				lead="Sides of"
				accent={owner ? "you" : "them"}
				sub={
					first && last
						? `${owner ? "You love" : "They love"} ${first.name.toLowerCase()}, and just as much ${last.name.toLowerCase()}. ${taste.sides.length} sides from ${total} titles ${owner ? "you love" : "they love"}.`
						: undefined
				}
			/>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{taste.sides.map((s) => {
					const on = s.id === side?.id
					const color = FAMILY_COLOR[attributeByKey.get(s.attributes[0]?.key ?? "")?.family ?? "story"]
					return (
						<button
							key={s.id}
							type="button"
							aria-pressed={on}
							onClick={() => setOpen(s.id)}
							className={`${PANEL} group relative flex min-w-0 items-center gap-4 overflow-hidden p-4 text-left transition-colors ${on ? "bg-white/[0.08] ring-white/40" : "hover:bg-white/[0.06]"}`}
						>
							<span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
							<span className="relative h-24 w-24 shrink-0" aria-hidden>
								{s.here.slice(0, 3).map((id, i) => (
									<span
										key={id}
										className="absolute top-0 block w-14 transition-transform duration-200 group-hover:translate-x-0"
										style={{ left: i * 18, transform: `rotate(${(i - 1) * 7}deg)`, zIndex: 3 - i }}
									>
										<PosterImg title={tt(id)} className="rounded-md shadow-xl ring-2 ring-gray-950" />
									</span>
								))}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-base leading-tight font-bold text-white">{s.name}</span>
								<span className="mt-1 block text-xs text-gray-400">
									{s.attributes
										.slice(0, 3)
										.map((a) => a.label)
										.join(" · ")}
								</span>
								<span className="mt-2 flex items-baseline gap-3 text-xs text-gray-500">
									<span>
										<b className="text-sm text-gray-200 tabular-nums">{s.count}</b> titles
									</span>
									<span>
										average <b className="text-sm text-gray-200 tabular-nums">{s.average}</b>
									</span>
								</span>
							</span>
						</button>
					)
				})}
			</div>
			{side && (
				<div className={`${PANEL} p-4 sm:p-5`} aria-live="polite">
					<p className="mb-3 text-sm text-gray-300">
						<b className="text-white">{side.name}</b>
						<span className="text-gray-500"> · {owner ? "you're here" : "they're here"}</span>
					</p>
					<ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
						{side.here.slice(0, 8).map((id, i) => (
							<li key={id} className={i >= 4 ? "max-sm:hidden" : ""}>
								<MiniPoster title={tt(id)} />
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	)
}
