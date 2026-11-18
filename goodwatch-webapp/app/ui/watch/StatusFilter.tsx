// All shows' status filter, first in the list's controls. Each status is a page of its own, so each choice is a link.
import type { NavChoice } from "~/ui/navigation/areas"
import { Segmented } from "~/ui/selection/Segmented"

export function StatusFilter({ statuses }: { statuses: NavChoice[] }) {
	return (
		<Segmented
			label="Show status"
			replace
			value={statuses.find((choice) => choice.here)?.key ?? ""}
			options={statuses.map(({ key, label, count, href }) => ({ key, label, count, href }))}
		/>
	)
}
