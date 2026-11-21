// PROTOTYPE - throwaway (prototype/explore-r5). Themes and styles as in Rooms, traits as in Dials.
import type { DialsData } from "../../../dials/loader.server"
import type { RoomsData } from "../../../rooms/loader.server"
import { DialsView, RoomsView, dialsNotes, roomsNotes } from "../../baselines"
import type { PageViewProps, SlotVariant } from "../../contract"
import type { OtherData } from "./r4.server"

const isDials = (
	p: PageViewProps<OtherData>,
): p is PageViewProps<OtherData> & { data: { from: "dials" } } => p.data.from === "dials"

export const variant: SlotVariant<OtherData> = {
	id: "r4",
	name: "Round 4",
	what: "Themes and styles as in Rooms (cards, then the Rooms place page); traits as in Dials (three evenings).",
	View: (props) =>
		isDials(props) ? (
			<DialsView {...props} data={props.data.page as DialsData} />
		) : (
			<RoomsView {...props} data={props.data.page as RoomsData} />
		),
	notes: (props) =>
		isDials(props)
			? dialsNotes({ ...props, data: props.data.page as DialsData })
			: roomsNotes({ ...props, data: props.data.page as RoomsData }),
}
