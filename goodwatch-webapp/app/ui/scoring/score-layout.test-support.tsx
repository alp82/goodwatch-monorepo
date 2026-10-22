// Run by score-layout.test.ts through vite-node: draws the shared score choices in each layout, as plain buttons.
import { renderToStaticMarkup } from "react-dom/server"
import { ScoreChoices, type ScoreLayout } from "./ScoreChoices"

const draw = (layout?: ScoreLayout) =>
	renderToStaticMarkup(
		<ScoreChoices
			value={8}
			hot={null}
			layout={layout}
			renderChoice={(choice) => (
				<button
					key={choice.id}
					type="button"
					data-id={choice.id}
					style={choice.style}
				>
					{choice.children}
				</button>
			)}
		/>,
	)
console.log(
	`__SCORE_LAYOUT__${JSON.stringify({ unset: draw(), grid: draw("grid"), band: draw("band") })}`,
)
