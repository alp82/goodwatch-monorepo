// PROTOTYPE - throwaway. Round 6, chapter 6: three layouts of "From everything to tonight." (narrow.tsx).
// A: number left, filters and big posters right. B: number over a full-width row of big posters, each filter
// called out big as it lands. C: filter first, a panel of large switches beside the number and three huge posters.
import type { ClipProps } from "../../clip"
import { BigNumber, Exit, Mark, Motion, Posters, Show, Toggle, Words, filterData, label, timeline } from "./narrow"

const TITLE = "From everything to tonight."
const AMBER = ["tonight"]

function Empty() {
	return <div className="lp6f" />
}

/** The tag that says the seen titles are an example member's. */
function ExampleNote({ at }: { at: number }) {
	return (
		<Motion kind="rise" at={at}>
			<div className="lp6f-note">Not seen yet: example member who has seen the 150 best-known titles</div>
		</Motion>
	)
}

// A. Number left, four big posters right, the filter bar along the bottom.
export function NumberLeft({ data }: ClipProps) {
	const d = filterData(data)
	if (!d) return <Empty />
	const steps = d.tonight.steps
	const tl = timeline(steps)
	const seenAt = tl.on[steps.findIndex((s) => s.kind === "seen")]
	return (
		<div className="lp6f lp6f-a">
			<div className="lp6f-a-left">
				<Motion kind="rise" at={0}>
					<div className="lp6f-kicker">Filters</div>
				</Motion>
				<Words text={TITLE} at={150} amber={AMBER} />
				<BigNumber steps={steps} tl={tl} d={d} />
			</div>
			<Posters path={d.tonight} tl={tl} cols={2} rows={2} className="lp6f-a-posters" />
			{/* The filter bar along the bottom, as on Discover, every switch big enough to read. */}
			<div className="lp6f-toggles lp6f-a-bar">
				{steps.map((s, i) => (
					<Toggle key={s.id} step={s} d={d} appear={250 + i * 90} on={tl.on[i]} tag={false} />
				))}
			</div>
			<ExampleNote at={seenAt} />
		</div>
	)
}

// B. Number over a full-width row of big posters; each filter is called out big as it switches on.
export function NumberOver({ data }: ClipProps) {
	const d = filterData(data)
	if (!d) return <Empty />
	const steps = d.tonight.steps
	const tl = timeline(steps, 800, 2050)
	const seenAt = tl.on[steps.findIndex((s) => s.kind === "seen")]
	return (
		<div className="lp6f lp6f-b">
			<div className="lp6f-b-top">
				<Words text={TITLE} at={150} amber={AMBER} />
				<div className="lp6f-toggles">
					{steps.map((s, i) => (
						<Toggle key={s.id} step={s} d={d} appear={300 + i * 90} on={tl.on[i]} />
					))}
				</div>
			</div>
			<BigNumber steps={steps} tl={tl} d={d} className="lp6f-b-number" />
			<Posters path={d.tonight} tl={tl} cols={6} className="lp6f-b-posters" />
			{/* The filter that just switched on, big over the posters, for as long as it is narrowing them. */}
			{steps.map((s, i) =>
				i === 0 ? null : (
					<Show key={s.id} at={tl.on[i] + 80} className="lp6f-callout-w">
						<Exit at={tl.swap[i] + 450} kind="lift">
							<Motion kind="pop" at={tl.on[i] + 80}>
								<div className="lp6f-callout">
									<Mark step={s} d={d} />
									<span>{label(s)}</span>
								</div>
							</Motion>
						</Exit>
					</Show>
				),
			)}
			<ExampleNote at={seenAt} />
		</div>
	)
}

// C. Filter first: a panel of large switches turns on one by one; the number and three huge posters answer.
export function FilterFirst({ data }: ClipProps) {
	const d = filterData(data)
	if (!d) return <Empty />
	const steps = d.tonight.steps
	const tl = timeline(steps)
	const seenAt = tl.on[steps.findIndex((s) => s.kind === "seen")]
	return (
		<div className="lp6f lp6f-c">
			<div className="lp6f-c-left">
				<Words text={TITLE} at={150} amber={AMBER} />
				<div className="lp6f-panel">
					{steps.map((s, i) => (
						<Toggle key={s.id} step={s} d={d} appear={350 + i * 110} on={tl.on[i]} className="lp6f-row" />
					))}
				</div>
			</div>
			<div className="lp6f-c-right">
				<BigNumber steps={steps} tl={tl} d={d} />
				<Posters path={d.tonight} tl={tl} cols={3} className="lp6f-c-posters" />
			</div>
			<ExampleNote at={seenAt} />
		</div>
	)
}
