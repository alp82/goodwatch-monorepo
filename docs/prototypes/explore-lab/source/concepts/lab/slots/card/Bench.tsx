// PROTOTYPE - throwaway (prototype/explore-r5). The card bench: every card variant × family × size on real data, in
// the three places a page puts cards (a 4-up grid, a dense row, a hero cell). /prototype/explore/_kit?bench=cards
import { Link } from "@remix-run/react"
import type { ComponentType } from "react"
import { type Family, PREFIX, href as hrefOf, ing, place } from "../../../../kit/address"
import type { CardProps } from "../../../../kit/types"
import { WRAP } from "../../../../kit/ui"
import { variantsOf } from "../../registry"
import type { BenchData } from "./bench.server"
import { Spines } from "./spines"

type CardView = ComponentType<CardProps & { data?: unknown }>

const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"

export function CardBench({ d }: { d: BenchData }) {
	const variants = variantsOf("card").filter((v) => !d.only.length || d.only.includes(v.id))
	const href = (family: Family, slug: string) => hrefOf("lab", place("movie", [ing(family, slug)]))
	const pill =
		"rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-gray-300 ring-1 ring-white/10 hover:bg-white/10"
	return (
		<div className="pb-24">
			<div className={`${WRAP} pt-10`}>
				<h1 className="font-display text-3xl font-bold tracking-tight text-white">Card bench</h1>
				<p className="mt-1 max-w-2xl text-sm text-gray-400">
					Every card variant, family and size on real data. A person should tell a mood from a genre
					from a country without reading.
				</p>
				<p className="mt-4 flex flex-wrap gap-2">
					<Link to={`${PREFIX}/_kit?bench=cards`} className={pill}>
						All
					</Link>
					{variantsOf("card").map((v) => (
						<Link key={v.id} to={`${PREFIX}/_kit?bench=cards&v=${v.id}`} className={pill}>
							{v.name}
						</Link>
					))}
				</p>
			</div>
			{variants.map((v) => {
				const View = v.View as unknown as CardView
				return (
					<section
						key={v.id}
						data-bench-variant={v.id}
						className="mt-12 border-t border-white/10 pt-8"
					>
						<div className={WRAP}>
							<h2 className="font-display text-2xl font-bold tracking-tight text-amber-300">
								{v.name}
							</h2>
							<p className="mt-1 max-w-3xl text-sm text-gray-400">{v.what}</p>
							{d.families.map((f) => {
								const props = f.cards.map((c) => ({
									...c,
									href: href(f.family, c.place.slug),
									data: d.marks,
								}))
								return (
									<div key={f.family} data-bench-family={f.family} className="mt-10">
										<h3 className="text-xs font-bold tracking-[0.14em] text-gray-500 uppercase">
											{f.label} · m, 4-up grid
										</h3>
										<div className={`mt-3 ${GRID}`}>
											{props.map((p) => (
												<View key={p.place.slug} {...p} size="m" />
											))}
										</div>
										{v.id === "spines" && (
											<>
												<h3 className="mt-8 text-xs font-bold tracking-[0.14em] text-gray-500 uppercase">
													{f.label} · the strip itself
												</h3>
												<div className="mt-3">
													<Spines cards={props} data={d.marks} />
												</div>
											</>
										)}
										<h3 className="mt-8 text-xs font-bold tracking-[0.14em] text-gray-500 uppercase">
											{f.label} · s, dense row
										</h3>
										<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
											{props.slice(0, 8).map((p) => (
												<View key={p.place.slug} {...p} size="s" />
											))}
										</div>
										<h3 className="mt-8 text-xs font-bold tracking-[0.14em] text-gray-500 uppercase">
											{f.label} · l, a hero cell beside two m
										</h3>
										<div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
											{props.slice(0, 1).map((p) => (
												<View key={p.place.slug} {...p} size="l" />
											))}
											{props.slice(1, 3).map((p) => (
												<View key={p.place.slug} {...p} size="m" />
											))}
										</div>
									</div>
								)
							})}
						</div>
					</section>
				)
			})}
		</div>
	)
}
