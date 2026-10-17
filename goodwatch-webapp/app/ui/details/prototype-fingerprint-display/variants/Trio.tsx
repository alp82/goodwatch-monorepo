// PROTOTYPE - throwaway.
// Band, versus and sliders in one calm block: thin color band as the key on top, bold versus lines lead, sliders on the right; all linked by color.
import { useState } from "react"
import { HEX, type Pillar } from "~/ui/details/DetailsFingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { AreaCardBody, Band, FloatCard, GROUPS, PairCardBody, PairText, ScaleCardBody, SlimTrack, pickPairs } from "./bandsliders-parts"
import { type Scale, reading } from "./slidestrip-parts"
import { SectionTitle, tagline } from "./strip-parts"
import { GoodForLine, areaOf } from "./versus-parts"

type Open =
	| { kind: "area"; p: Pillar; el: HTMLElement }
	| { kind: "scale"; sc: Scale; el: HTMLElement }
	| { kind: "pair"; i: number; el: HTMLElement }
	| null

function Mini({
	sc,
	t,
	focus,
	on,
	onHover,
	onPick,
}: {
	sc: Scale
	t: F.TitleInput
	focus: Pillar | null
	on: boolean
	onHover: (p: Pillar | null) => void
	onPick: (el: HTMLElement) => void
}) {
	const r = reading(sc, t)
	const dim = focus !== null && focus !== sc.area
	return (
		<li className="min-w-0">
			<button
				type="button"
				data-fp-trigger
				aria-haspopup="dialog"
				aria-expanded={on}
				onPointerEnter={(e) => e.pointerType === "mouse" && onHover(sc.area)}
				onPointerLeave={(e) => e.pointerType === "mouse" && onHover(null)}
				onFocus={() => onHover(sc.area)}
				onBlur={() => onHover(null)}
				onClick={(e) => onPick(e.currentTarget)}
				className={`-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 pb-2.5 pt-1.5 text-left transition-colors hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "bg-white/[.06]" : ""}`}
			>
				<span className={`flex flex-wrap items-baseline justify-between gap-x-3 transition-opacity duration-200 ${dim ? "opacity-40" : ""}`}>
					<span className="text-[13px] text-gray-400">{sc.name}</span>
					<span className="text-sm font-semibold text-white">{r.word}</span>
				</span>
				<span className="mt-2 block">
					<SlimTrack sc={sc} v={r.v} word={r.word} dim={dim} />
				</span>
			</button>
		</li>
	)
}

export default function Trio({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const [open, setOpen] = useState<Open>(null)
	const [hover, setHover] = useState<Pillar | null>(null)
	// Three lines at most, preferring lines from different areas so the column doesn't turn one color.
	const pool = pickPairs(s, 6)
	const distinct = pool.filter((x, i) => pool.findIndex((y) => areaOf(y.hi) === areaOf(x.hi)) === i)
	const pairs = [...distinct, ...pool.filter((x) => !distinct.includes(x))].slice(0, 3)
	const pairArea = (i: number) => areaOf(pairs[i].hi)
	const openArea = !open ? null : open.kind === "area" ? open.p : open.kind === "scale" ? open.sc.area : pairArea(open.i)
	const focus = openArea ?? hover

	const toggle = (next: NonNullable<Open>, same: boolean) => setOpen(same ? null : next)
	const mini = (sc: Scale) => {
		const on = open?.kind === "scale" && open.sc.name === sc.name
		return <Mini key={sc.name} sc={sc} t={t} focus={focus} on={on} onHover={setHover} onPick={(el) => toggle({ kind: "scale", sc, el }, on)} />
	}
	const [feel, story, look] = GROUPS
	const head = "mb-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

	return (
		<div>
			<SectionTitle t={t} />

			<div className="mt-4">
				<Band
					t={t}
					size="thin"
					focus={focus}
					open={open?.kind === "area" ? open.p : null}
					onHover={setHover}
					onPick={(p, el) => toggle({ kind: "area", p, el }, open?.kind === "area" && open.p === p)}
				/>
			</div>

			<div className="mt-6 grid gap-x-14 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
				<div className="flex flex-col">
					{pairs.length ? (
						<ul className="space-y-1.5">
							{pairs.map(({ p }, i) => {
								const on = open?.kind === "pair" && open.i === i
								const area = pairArea(i)
								const dim = focus !== null && focus !== area
								return (
									<li key={p.a + p.b}>
										<button
											type="button"
											data-fp-trigger
											aria-haspopup="dialog"
											aria-expanded={on}
											onPointerEnter={(e) => e.pointerType === "mouse" && setHover(area)}
											onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
											onFocus={() => setHover(area)}
											onBlur={() => setHover(null)}
											onClick={(e) => toggle({ kind: "pair", i, el: e.currentTarget }, on)}
											className={`-mx-2 cursor-pointer rounded-xl px-2 py-0.5 text-left text-[1.75rem] font-bold leading-tight tracking-tight transition-opacity duration-200 hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-amber-300 sm:text-[2.25rem] ${
												dim ? "opacity-35" : ""
											} ${on ? "bg-white/[.06]" : ""}`}
										>
											<PairText p={p} color={HEX[area]} />
										</button>
									</li>
								)
							})}
						</ul>
					) : (
						<p className="text-3xl font-bold tracking-tight text-amber-200 sm:text-4xl">{tagline(t, media)}.</p>
					)}
					<p className="mt-5 max-w-md text-[15px] leading-relaxed text-gray-400 max-lg:hidden">{F.summary(t)}</p>
					<GoodForLine t={t} className="mt-auto pt-4 max-lg:hidden" />
				</div>

				<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8">
					<section className="col-span-2 sm:col-span-1">
						<h3 className={head}>{feel.name}</h3>
						<ul className="grid grid-cols-2 gap-x-5 sm:grid-cols-1">{feel.scales.map(mini)}</ul>
					</section>
					<div className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:col-span-1 sm:grid-cols-1">
						<section className="col-span-2 sm:col-span-1">
							<h3 className={head}>{story.name}</h3>
							<ul className="grid grid-cols-2 items-end gap-x-5 sm:grid-cols-1">{story.scales.map(mini)}</ul>
						</section>
						<section className="col-span-2 sm:col-span-1">
							<h3 className={head}>{look.name}</h3>
							<ul className="grid grid-cols-2 gap-x-5 sm:grid-cols-1">{look.scales.map(mini)}</ul>
						</section>
					</div>
				</div>
			</div>
			<GoodForLine t={t} className="mt-5 lg:hidden" />

			{open && (
				<FloatCard
					anchor={open.el}
					onClose={() => setOpen(null)}
					label={open.kind === "area" ? `${open.p} in detail` : open.kind === "scale" ? `${open.sc.name} in detail` : "Where this comes from"}
					color={HEX[openArea ?? "Energy"]}
					width={open.kind === "area" ? 380 : 340}
				>
					{open.kind === "area" ? (
						<AreaCardBody p={open.p} t={t} />
					) : open.kind === "scale" ? (
						<ScaleCardBody sc={open.sc} t={t} />
					) : (
						<PairCardBody hi={pairs[open.i].hi} other={pairs[open.i].other} s={s} color={HEX[pairArea(open.i)]} />
					)}
				</FloatCard>
			)}
		</div>
	)
}
