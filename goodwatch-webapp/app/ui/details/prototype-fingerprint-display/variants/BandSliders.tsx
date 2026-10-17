// PROTOTYPE - throwaway.
// Barcode band as the signature header, all slider readings under it in Feel / Story / Look; band and sliders light each other up, evidence floats.
import { useState } from "react"
import { HEX, type Pillar } from "~/ui/details/DetailsFingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { AreaCardBody, Band, FloatCard, GROUPS, ScaleCardBody, SlimTrack } from "./bandsliders-parts"
import { type Scale, reading } from "./slidestrip-parts"
import { SectionTitle } from "./strip-parts"
import { GoodForLine } from "./versus-parts"

type Open = { kind: "area"; p: Pillar; el: HTMLElement } | { kind: "scale"; sc: Scale; el: HTMLElement } | null

function SliderRow({
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
				className={`-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 pb-1.5 pt-2 text-left transition-colors hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "bg-white/[.06]" : ""}`}
			>
				<span className={`flex flex-wrap items-baseline justify-between gap-x-3 transition-opacity duration-200 ${dim ? "opacity-40" : ""}`}>
					<span className="text-[13px] text-gray-400">{sc.name}</span>
					<span className="text-sm font-semibold text-white">{r.word}</span>
				</span>
				<span className="mt-2 block">
					<SlimTrack sc={sc} v={r.v} word={r.word} dim={dim} />
				</span>
				<span
					aria-hidden="true"
					className={`mt-1.5 flex justify-between gap-2 text-[11px] text-gray-500 transition-opacity duration-200 ${dim ? "opacity-40" : ""}`}
				>
					<span className={r.near === "left" ? "text-gray-300" : ""}>{sc.left}</span>
					<span className={r.near === "right" ? "text-gray-300" : ""}>{sc.right}</span>
				</span>
			</button>
		</li>
	)
}

export default function BandSliders({ t }: VariantProps) {
	const [open, setOpen] = useState<Open>(null)
	const [hover, setHover] = useState<Pillar | null>(null)
	const openArea = open?.kind === "area" ? open.p : open?.kind === "scale" ? open.sc.area : null
	const focus = openArea ?? hover

	const row = (sc: Scale) => (
		<SliderRow
			key={sc.name}
			sc={sc}
			t={t}
			focus={focus}
			on={open?.kind === "scale" && open.sc.name === sc.name}
			onHover={setHover}
			onPick={(el) => setOpen(open?.kind === "scale" && open.sc.name === sc.name ? null : { kind: "scale", sc, el })}
		/>
	)
	const [feel, story, look] = GROUPS
	const head = "mb-1 text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

	return (
		<div>
			<SectionTitle t={t} />
			<p className="mt-2 max-w-3xl text-gray-300">{F.summary(t)}</p>

			<div className="mt-5">
				<Band
					t={t}
					focus={focus}
					open={open?.kind === "area" ? open.p : null}
					onHover={setHover}
					onPick={(p, el) => setOpen(open?.kind === "area" && open.p === p ? null : { kind: "area", p, el })}
				/>
			</div>

			<div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4 lg:gap-x-10">
				<section className="col-span-2">
					<h3 className={head}>{feel.name}</h3>
					<ul className="grid grid-flow-row grid-cols-2 gap-x-5 lg:grid-flow-col lg:grid-rows-3 lg:gap-x-10">{feel.scales.map(row)}</ul>
				</section>
				<section className="max-lg:col-span-2">
					<h3 className={head}>{story.name}</h3>
					<ul className="grid grid-cols-2 items-end gap-x-5 lg:grid-cols-1">{story.scales.map(row)}</ul>
				</section>
				<section className="max-lg:col-span-2">
					<h3 className={head}>{look.name}</h3>
					<ul className="grid grid-cols-2 items-end gap-x-5 lg:grid-cols-1">{look.scales.map(row)}</ul>
				</section>
			</div>

			<div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
				<GoodForLine t={t} />
				<p className="text-xs text-gray-500">Select a color or a reading to see the traits behind it.</p>
			</div>

			{open && (
				<FloatCard
					anchor={open.el}
					onClose={() => setOpen(null)}
					label={open.kind === "area" ? `${open.p} in detail` : `${open.sc.name} in detail`}
					color={HEX[open.kind === "area" ? open.p : open.sc.area]}
					width={open.kind === "area" ? 380 : 340}
				>
					{open.kind === "area" ? <AreaCardBody p={open.p} t={t} /> : <ScaleCardBody sc={open.sc} t={t} />}
				</FloatCard>
			)}
		</div>
	)
}
