// The At a glance sub-page's content: every row of the title page's At a glance (glance-rows.tsx, so a row added or
// dropped there shows here too) opened, one after another, each under its own heading. The row's closed line (its
// value and teaser) leads, its opened content follows. The rows go to the rail as the sub-page's parts
// (rail/rail-model.ts); each part's id is its row's id.
import { useEffect } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { glanceBridge } from "~/ui/details/rail/rail-model"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { useTitleQuestions } from "~/ui/details/useTitleQuestions"
import GlanceDetail from "./GlanceDetail"
import { type GlanceRow, useGlanceRows } from "./glance-rows"

type Media = MovieResult | ShowResult

export function AtAGlancePage({
	media,
	country,
}: { media: Media; country: string }) {
	const questions = useTitleQuestions(media, country)
	const rows = useGlanceRows({ media, country, questions })
	const sig = rows.map((r) => `${r.id}:${r.label}`).join("|")
	useEffect(() => {
		glanceBridge.set(rows.map((r) => ({ id: r.id, label: r.label })))
		return () => glanceBridge.set(null)
	}, [sig])
	return (
		<div data-feedback-area="details" className="flex flex-col">
			{rows.map((r, i) => (
				<GlancePart
					key={r.id}
					row={r}
					first={i === 0}
					media={media}
					country={country}
					questions={questions}
				/>
			))}
		</div>
	)
}

function GlancePart({
	row,
	first,
	media,
	country,
	questions,
}: {
	row: GlanceRow
	first: boolean
	media: Media
	country: string
	questions: TitleQuestion[]
}) {
	return (
		<section
			id={row.id}
			aria-labelledby={`${row.id}-h`}
			className={`min-w-0 scroll-mt-32 ${first ? "" : "mt-12 border-t border-white/10 pt-10"}`}
		>
			<h2
				id={`${row.id}-h`}
				className="text-[19px] font-semibold tracking-tight text-white sm:text-xl"
			>
				{row.label}
			</h2>
			<div className="mt-1.5 max-w-[46rem] text-[15px] leading-snug text-gray-300">
				{row.value}
				{row.teaser}
			</div>
			{/* Headings inside a row's content stay below the part's. */}
			<div className="mt-6 min-w-0 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-100">
				<GlanceDetail
					id={row.id}
					media={media}
					country={country}
					questions={questions}
				/>
			</div>
		</section>
	)
}
