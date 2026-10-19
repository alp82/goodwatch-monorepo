// One of the streaming study's charts: the question as its heading, ranked bars drawn as SVG in the server's HTML (no
// script needed), the caption, and a note with the source. Every bar has a native tooltip, the SVG has a description,
// and the numbers of every country are in the table the note links to.
// A post can give its own question and caption (its children, written in Markdown, footnote markers included). Without
// them the chart says the question and the one-sentence answer study-charts.ts builds from the data.
import type { ReactNode } from "react"
import { layoutBars } from "./ranked-bars-layout"
import { type ChartId, type StudyData, chartSpec, fmt } from "./study-charts"

export const COUNTRY_TABLE_ID = "every-country"

export function StudyChart({
	data,
	id,
	question,
	children,
}: {
	data: StudyData
	id: ChartId
	question?: string
	children?: ReactNode
}) {
	const generated = chartSpec(data, id)
	const spec = { ...generated, question: question ?? generated.question }
	const layout = layoutBars(spec.rows, spec)
	const headingId = `chart-${id}`
	const descriptionId = `chart-${id}-description`
	const titleId = `chart-${id}-title`
	// On a phone the chart takes the column's full width, so its labels show at their full size. From sm up it sits
	// on a card.
	return (
		<figure
			aria-labelledby={headingId}
			className="my-10 flex flex-col gap-3 sm:rounded-2xl sm:bg-white/[0.04] sm:p-6 sm:ring-1 sm:ring-white/10"
		>
			<h3
				id={headingId}
				className="text-lg font-bold tracking-tight text-white sm:text-xl"
			>
				{spec.question}
			</h3>
			{children ? null : (
				<p className="text-base leading-relaxed text-gray-300">{spec.answer}</p>
			)}
			<svg
				viewBox={`0 0 ${layout.width} ${layout.height}`}
				role="img"
				aria-labelledby={`${titleId} ${descriptionId}`}
				className="mt-2 block h-auto w-full max-w-[448px] font-sans"
			>
				<title id={titleId}>{spec.question}</title>
				<desc id={descriptionId}>{spec.description}</desc>
				{layout.ticks.map((tick) => (
					<g key={tick.value}>
						<line
							x1={tick.x}
							x2={tick.x}
							y1={16}
							y2={layout.gridBottom}
							className="stroke-white/10"
							strokeWidth={1}
						/>
						<text
							x={tick.x}
							y={12}
							textAnchor={tick.anchor}
							className="fill-gray-400 text-[10.5px] tabular-nums"
						>
							{fmt(tick.value)}
						</text>
					</g>
				))}
				{layout.bars.map((bar) => (
					<g key={bar.code}>
						<title>{`${bar.label}: ${fmt(bar.value)}${bar.sub ? ` (${bar.sub})` : ""}`}</title>
						<text
							x={layout.plotX - 8}
							y={bar.y + layout.barHeight - 1}
							textAnchor="end"
							className="fill-gray-300 text-[12px]"
						>
							{bar.label}
						</text>
						{bar.sub ? (
							<text
								x={layout.plotX - 8}
								y={bar.y + layout.barHeight + 12}
								textAnchor="end"
								className="fill-gray-400 text-[10.5px]"
							>
								{bar.sub}
							</text>
						) : null}
						<path
							d={bar.path}
							className={bar.accent ? "fill-amber-600" : "fill-gray-500"}
						/>
						<text
							x={bar.valueX}
							y={bar.y + layout.barHeight - 1}
							className="fill-gray-100 text-[11.5px] font-semibold tabular-nums"
						>
							{fmt(bar.value)}
						</text>
					</g>
				))}
			</svg>
			<figcaption className="flex flex-col gap-2">
				{children ? (
					<div className="text-base leading-relaxed text-gray-300 [&_p]:my-0">
						{children}
					</div>
				) : null}
				<p className="text-xs leading-relaxed text-gray-400">
					{spec.note}{" "}
					<a
						href={`#${COUNTRY_TABLE_ID}`}
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						Every country's numbers
					</a>
				</p>
			</figcaption>
		</figure>
	)
}
