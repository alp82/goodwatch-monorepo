// PROTOTYPE (start page lab): browse b · Talked about now + hubs: the site's "Talked about now" row (StartRow), then the hubs as one row of chips.
import "~/ui/talked-about-now/start-row/start-row.css"
import type { CSSProperties } from "react"
import StartRow from "~/ui/talked-about-now/start-row/StartRow"
import { useLab } from "../../lab/types"
import { HubChips, lrbStyle } from "./HubChips"

export function TalkedHubs() {
	const { data } = useLab()
	return (
		<div className="lrb" style={lrbStyle}>
			<div className="lrb-in" style={{ "--lrb-gap": "2.5rem", paddingTop: "2rem", paddingBottom: "2rem" } as CSSProperties}>
				{data.talked && <StartRow row={data.talked} />}
				<section aria-labelledby="browse-b-h">
					<h2 id="browse-b-h" className="mb-3 !text-lg">
						Browse GoodWatch
					</h2>
					<HubChips />
				</section>
			</div>
		</div>
	)
}
