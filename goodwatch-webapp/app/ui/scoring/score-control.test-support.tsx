import { ScoreFace, SplitFrame } from "~/ui/details/hero/seen-score-faces"
import { renderToStaticMarkup } from "react-dom/server"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { SCORES } from "./score-model"

const draw = (value: (typeof SCORES)[number] | null, busy = false) =>
	renderToStaticMarkup(
		<ScoreControl
			value={value}
			busy={busy}
			onRate={() => {}}
			onClear={() => {}}
		/>,
	)
console.log(
	`__SCORE_CONTROL__${JSON.stringify({
		faces: SCORES.map((score) =>
			renderToStaticMarkup(
				<SplitFrame
					score={score}
					left="Seen"
					right={<ScoreFace score={score} ask="Rate it" />}
				/>,
			),
		),
		empty: draw(null),
		scored: SCORES.map((n) => draw(n)),
		busy: draw(7, true),
	})}`,
)
