// PROTOTYPE (discover-easy) round 3 A "Sentence": the search field, then one quiet line. Before a search it offers
// three examples; after one it reads back what was understood as a sentence whose words open Change / Remove.
import { Fragment } from "react"
import { ProtoSearch, useInterpretedSearch } from "./ProtoSearch"
import { EXAMPLES, type Easy, Token, and, filtersOf, wantsOf } from "./bits"

export const name = "Sentence"

export function EasyA({ e }: { e: Easy }) {
	const { run } = useInterpretedSearch()
	const filters = filtersOf(e)
	const wants = wantsOf(e).slice(0, 2)
	const asked = e.query !== null || filters.length > 0
	return (
		<div>
			<ProtoSearch query={e.query} onClear={e.clearSearch} phone={e.phone} />
			<div className="mt-3 flex flex-col gap-3 px-1 lg:flex-row lg:items-start lg:justify-between">
				<p className="text-[15px] leading-7 text-gray-400">
					{asked ? (
						<>
							{filters.map((c, i) => (
								<Fragment key={c.key}>
									{i > 0 && <span className="text-gray-600"> · </span>}
									<Token chip={c} e={e} />
								</Fragment>
							))}
							{e.query !== null && (
								<>
									{filters.length ? ", matching " : "Matching "}
									<span className="search-private font-semibold text-white">“{e.query}”</span>
								</>
							)}
							{wants.length > 0 && <>, ranked for {and(wants.map((w) => w.label.toLowerCase()))}</>}
							.{" "}
							<button type="button" onClick={e.customize} className="cursor-pointer font-semibold text-amber-400 hover:text-amber-300">
								Fine-tune
							</button>
						</>
					) : (
						<>
							Try{" "}
							{EXAMPLES.map((x, i) => (
								<Fragment key={x}>
									{i > 0 && (i === EXAMPLES.length - 1 ? " or " : ", ")}
									<button type="button" onClick={() => run(x)} className="cursor-pointer text-gray-200 underline decoration-white/20 underline-offset-4 hover:text-white">
										{x}
									</button>
								</Fragment>
							))}
							.
						</>
					)}
				</p>
				<div className="shrink-0">{e.ready}</div>
			</div>
		</div>
	)
}
