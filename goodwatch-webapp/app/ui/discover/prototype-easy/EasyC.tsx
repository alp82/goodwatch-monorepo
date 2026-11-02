// PROTOTYPE (discover-easy) round 3 C "Answer": the search field, then the results' own heading answers the search:
// "Matching “funny”", one quiet line of filters underneath, and why they rank as they do.
import { Fragment } from "react"
import { ProtoSearch } from "./ProtoSearch"
import { type Easy, Token, and, filtersOf, wantsOf } from "./bits"

export const name = "Answer"

export function EasyC({ e }: { e: Easy }) {
	const filters = filtersOf(e)
	const wants = wantsOf(e).slice(0, 3)
	const asked = e.query !== null || filters.length > 0
	return (
		<div>
			<ProtoSearch query={e.query} onClear={e.clearSearch} phone={e.phone} />
			<div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div className="min-w-0">
					<h2 className="brand-header text-2xl leading-tight text-white lg:text-[28px]">
						{!asked ? (
							"Popular right now"
						) : e.query !== null ? (
							<>
								Matching <span className="search-private text-amber-300">“{e.query}”</span>
							</>
						) : (
							"Your picks"
						)}
					</h2>
					{asked && (
						<p className="mt-2 text-[15px] leading-7 text-gray-400">
							{filters.map((c, i) => (
								<Fragment key={c.key}>
									{i > 0 && <span className="text-gray-600"> · </span>}
									<Token chip={c} e={e} />
								</Fragment>
							))}
							{wants.length > 0 && (
								<>
									{filters.length ? <span className="text-gray-600"> — </span> : null}
									best fits first for {and(wants.map((w) => w.label.toLowerCase()))}
								</>
							)}
							<button type="button" onClick={e.customize} className="ml-3 cursor-pointer font-semibold text-amber-400 hover:text-amber-300">
								Adjust
							</button>
						</p>
					)}
				</div>
				<div className="shrink-0">{e.ready}</div>
			</div>
		</div>
	)
}
