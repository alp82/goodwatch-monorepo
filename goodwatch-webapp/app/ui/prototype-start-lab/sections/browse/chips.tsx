// PROTOTYPE (start page lab): browse a · Hub chips: every hub as one compact row of chips, scrolling sideways on phones.
import { HubChips, lrbStyle } from "./HubChips"

export function Chips() {
	return (
		<section aria-labelledby="browse-a-h" className="lrb" style={lrbStyle}>
			<div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
				<h2 id="browse-a-h" className="mb-3 !text-lg">
					Browse GoodWatch
				</h2>
				<HubChips />
			</div>
		</section>
	)
}
