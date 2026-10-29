import { ScoreKeys } from "~/ui/my-library/scores/ScoreRow"
import {
	ScoreFace,
	SplitFrame,
	StatusFace,
} from "~/ui/details/hero/seen-score-faces"
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
		library: renderToStaticMarkup(<ScoreKeys score={7} gw={8} label="Your score for Dune" onPick={() => {}} />),
		faces: SCORES.map((score) =>
			renderToStaticMarkup(
				<SplitFrame
					score={score}
					left="Seen"
					right={<ScoreFace score={score} ask="Rate it" />}
				/>,
			),
		),
		status: renderToStaticMarkup(
			<SplitFrame
				big
				score={1}
				left={
					<StatusFace
						tone="new_episodes"
						label="12 new episodes"
						detail="S2 E4 · 24/36"
					/>
				}
				right={<ScoreFace score={1} ask="Rate it" />}
			/>,
		),
		empty: draw(null),
		scored: SCORES.map((n) => draw(n)),
		busy: draw(7, true),
	})}`,
)
