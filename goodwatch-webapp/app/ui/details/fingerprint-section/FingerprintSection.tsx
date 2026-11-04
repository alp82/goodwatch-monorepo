// The title page's Fingerprint section: the effect lines with a small print beside them, readable at a glance,
// nothing to hover, pick or switch. The whole section is one link into the fingerprint sub-page (`href`): the lines,
// the drawing and the "whole fingerprint" row light up together on hover.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useId, useMemo } from "react"
import { POPULATION_MEDIANS } from "~/domain/fingerprint-effects/population-medians"
import { useSectionNear } from "~/ui/details/below-fold"
import {
	RidgeSprite,
	printGeometry,
} from "~/ui/details/fingerprint-section/Shape"
import {
	printAttributes,
	readTitle,
} from "~/ui/details/fingerprint-section/reading"
import { SECTION_STYLE } from "~/ui/details/fingerprint-section/styles"
import { fingerprintInput } from "~/ui/details/title-words"
import { Lines, NotFor } from "./EffectLines"
import { Print } from "./Print"
import { type Media, notForLine } from "./print-model"

export function FingerprintSection({
	media,
	href,
}: {
	media: Media
	/** The fingerprint sub-page. */
	href: string
}) {
	const t = useMemo(() => fingerprintInput(media), [media])
	const reading = useMemo(() => (t ? readTitle(t) : null), [t])
	const type = media.mediaType
	const scores = t?.fingerprint.scores
	// The print's ridges are drawn once the section comes near: they have no words for search engines, and their
	// coordinates would be a large share of the page's HTML.
	const near = useSectionNear()
	const geo = useMemo(
		() =>
			near && scores
				? printGeometry(printAttributes(scores, POPULATION_MEDIANS[type]))
				: null,
		[near, scores, type],
	)
	const ridges = `fp-ridges-${useId().replace(/:/g, "")}`
	if (!reading) return null
	const label = `What it does to you, on eight feelings: ${reading.axes.map((a) => `${a.axis.label} ${a.strength.toFixed(1)}`).join(", ")}.`
	return (
		<div
			data-feedback-area="analysis"
			data-fingerprint-section=""
			className="@container/fp"
		>
			<style>{SECTION_STYLE}</style>
			<Link
				to={href}
				prefetch="intent"
				aria-label="The whole fingerprint"
				className="group -mx-3 block rounded-2xl px-3 py-3 outline-none ring-1 ring-transparent transition-[background-color,box-shadow] duration-200 hover:bg-white/[0.035] hover:ring-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
			>
				{geo && <RidgeSprite id={ridges} geo={geo} />}
				<div className="grid items-center gap-x-6 gap-y-3 @min-[560px]/fp:grid-cols-[minmax(0,1fr)_19rem] @min-[760px]/fp:grid-cols-[minmax(0,1fr)_23rem]">
					<div className="mx-auto w-full max-w-[20rem] @min-[560px]/fp:order-2 @min-[560px]/fp:max-w-none">
						<div className="transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
							<Print
								reading={reading}
								geo={geo}
								ridges={ridges}
								labels="bold"
								label={label}
								W={200}
								H={176}
							/>
						</div>
					</div>
					<div className="min-w-0">
						<Lines rows={reading.rows} size="sm" />
						<NotFor line={notForLine(reading.not)} className="mt-2" />
					</div>
				</div>
				<span className="mt-4 flex w-fit items-center gap-2 text-[15px] font-semibold text-amber-300/90 group-hover:text-amber-300">
					<span>The whole fingerprint</span>
					<span className="font-medium text-gray-500 group-hover:text-gray-400 max-sm:hidden">
						· the print and its 12 scales
					</span>
					<ChevronRightIcon
						className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</span>
			</Link>
		</div>
	)
}
