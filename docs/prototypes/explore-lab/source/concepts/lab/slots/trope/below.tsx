// PROTOTYPE - throwaway (prototype/explore-r9). Sections under a trope's examples, like the mood, country and era pages
// have under their lists (slot "trope-below" picks which and how): how it grew decade by decade as a tall row, the
// moods, genres, decades and countries it blends well with (each a real blend page), and the people behind it.
import { Link } from "@remix-run/react"
import type { CSSProperties, ReactNode } from "react"
import { RowArrows, useStepRow } from "~/ui/row-arrows"
import { type Address, ing, place } from "../../../../kit/address"
import { FOCUS, PeopleStrip, poster } from "../../../../kit/ui"
import { GLIDE_T, QUICK_T } from "../../../../kit/ui/motion"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import type { PageViewProps } from "../../contract"
import { ModuleHead } from "../../../rooms/parts"
import { type TropePageData, many } from "../tropes/model"
import { PosterFan } from "../tropes/parts"

export interface BelowProps {
	d: TropePageData
	kind: Address["kind"]
	to: PageViewProps["to"]
	noun: string
}

const FAMILY: Record<string, string> = {
	mood: "Mood",
	genre: "Genre",
	decade: "Decade",
	country: "Country",
}

/** How it grew: one tall column per decade (its share of that decade's titles), with the decade's best-known three. */
export function Timeline({ d, kind, to, noun }: BelowProps) {
	const row = useStepRow<HTMLOListElement>([d.timeline.length])
	const rows = d.timeline.filter((x) => x.n > 0)
	if (rows.length < 3) return null
	const peak = rows.reduce((a, b) => (b.share > a.share ? b : a), rows[0])
	const tint = d.trope.color
	const barMax = 150
	return (
		<section style={{ "--tint": tint } as CSSProperties}>
			<ModuleHead
				title="How it grew"
				line={`How common it is among each decade's well-known ${noun}. The ${peak.label} had the most.`}
				aside={<RowArrows row={row} label="decades" />}
			/>
			<ol
				ref={row.ref}
				onScroll={row.measure}
				className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
			>
				{rows.map((x) => {
					const on = x === peak
					return (
						<li key={x.slug} className="min-w-[6.5rem] flex-1">
							<Link
								to={to(place(kind, [ing("trope", d.trope.slug), ing("decade", x.slug)]))}
								prefetch="intent"
								className={`group flex h-full flex-col items-center rounded-xl px-2 pt-3 pb-3 ${QUICK_T} hover:bg-white/[0.04] ${FOCUS}`}
							>
								<span
									className={`text-sm font-semibold tabular-nums ${on ? "text-white" : "text-gray-400"}`}
								>
									{many(x.n)}
								</span>
								<span
									className="mt-1.5 flex w-full items-end justify-center"
									style={{ height: barMax }}
								>
									<span
										className={`w-full max-w-12 origin-bottom rounded-t-md ${GLIDE_T} group-hover:scale-y-[1.04]`}
										style={{
											height: Math.max(4, x.share * barMax),
											background: on
												? "var(--tint)"
												: "color-mix(in oklab, var(--tint) 28%, rgba(255,255,255,0.08))",
										}}
									/>
								</span>
								<>
									<span className="relative mt-3 flex h-[84px] w-full justify-center">
										{x.titles.slice(0, 3).map((t, i) => {
											const src = poster(t.card.poster_path, "w154")
											return (
												<span
													key={t.card.key}
													className={`absolute top-0 h-[78px] w-[52px] overflow-hidden rounded-md bg-gray-800 shadow-lg ring-1 ring-black/40 ${GLIDE_T}`}
													style={{
														translate: `${(i - 1) * 22}px ${i === 1 ? 0 : 4}px`,
														rotate: `${(i - 1) * 6}deg`,
														zIndex: i === 1 ? 2 : 1,
													}}
												>
													{src && (
														<img
															src={src}
															alt=""
															loading="lazy"
															className="h-full w-full object-cover"
														/>
													)}
												</span>
											)
										})}
									</span>
								</>
								<span
									className={`mt-2 text-sm font-bold ${on ? "text-[color-mix(in_oklab,var(--tint)_70%,white)]" : "text-gray-300"}`}
								>
									{x.label}
								</span>
							</Link>
						</li>
					)
				})}
			</ol>
		</section>
	)
}

function Glyph({ s }: { s: TropePageData["ways"][number] }) {
	if (s.place.family === "country" && s.place.code)
		return <FlagShape code={s.place.code} size={20} state="on" />
	return (
		<span
			aria-hidden
			className="h-2.5 w-2.5 shrink-0 rounded-full"
			style={{ background: s.place.hue ?? "rgba(255,255,255,0.35)" }}
		/>
	)
}

/** Where it blends well: each a real blend page (part + this trope), with how many titles and three posters. */
export function Ways({ d, kind, to, noun, compact = false }: BelowProps & { compact?: boolean }) {
	if (!d.ways.length) return null
	const href = (s: TropePageData["ways"][number]) =>
		to(place(kind, [ing(s.place.family, s.place.slug), ing("trope", d.trope.slug)]))
	return (
		<section>
			<ModuleHead
				title="Blend it"
				line={`Where it shows up more than usual. Each opens the ${noun} that have both.`}
			/>
			{compact ? (
				<ul className="mt-4 flex flex-wrap gap-2">
					{d.ways.map((s) => (
						<li key={`${s.place.family}-${s.place.slug}`}>
							<Link
								to={href(s)}
								prefetch="intent"
								className={`flex items-center gap-2 rounded-full bg-white/[0.05] py-1.5 pr-3 pl-2.5 text-sm font-semibold text-gray-200 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/10 hover:text-white ${FOCUS}`}
							>
								<Glyph s={s} />
								{s.place.label}
								<span className="font-normal text-gray-500 tabular-nums">{many(s.count)}</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{d.ways.map((s) => (
						<li key={`${s.place.family}-${s.place.slug}`}>
							<Link
								to={href(s)}
								prefetch="intent"
								className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10 ${GLIDE_T} hover:-translate-y-0.5 hover:bg-white/[0.05] hover:ring-white/20 ${FOCUS}`}
							>
								<span
									className="flex h-28 items-end justify-center overflow-hidden"
									style={{
										background: `radial-gradient(110% 90% at 50% 100%, color-mix(in oklab, ${s.place.hue ?? d.trope.color} 30%, transparent), transparent 72%)`,
									}}
								>
									<PosterFan titles={s.titles} width={58} className="mb-[-18%]" />
								</span>
								<span className="flex flex-1 flex-col p-3.5">
									<span className="text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
										{FAMILY[s.place.family] ?? s.place.family}
									</span>
									<span className="mt-1 flex items-center gap-2 font-semibold text-white">
										<Glyph s={s} />
										<span className="truncate">{s.place.label}</span>
									</span>
									<span className="mt-0.5 text-[13px] text-gray-400">
										+ {d.trope.label} · {many(s.count)} {noun}
									</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

/** The people behind most of its well-known titles. */
export function People({ d }: { d: TropePageData }): ReactNode {
	if (!d.people.length) return null
	return (
		<PeopleStrip
			people={d.people}
			head={(arrows) => (
				<ModuleHead
					title="Who keeps using it"
					aside={arrows}
					line="The people behind the most of them."
				/>
			)}
		/>
	)
}
