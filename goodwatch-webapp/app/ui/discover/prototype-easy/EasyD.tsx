// PROTOTYPE (discover-easy) round 4 D "Card": the same card as Advanced (fingerprint + filters) under the search, so
// both modes read the search the same way; Ready on its own row.
import { Readout } from "./Readout"
import type { Easy } from "./bits"

export const name = "Card"

export function EasyD({ e }: { e: Easy }) {
	return (
		<div>
			<Readout query={e.query} reading={e.reading} chips={e.chips} onRemove={e.remove} onOpen={e.open} onCustomize={e.customize} easy />
			<div className="mt-3 flex">{e.ready}</div>
		</div>
	)
}
