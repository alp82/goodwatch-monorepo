// PROTOTYPE - throwaway (prototype/explore-r5). The round 4 pages as lab variants: each `slots/<slot>/r4.tsx` wires
// one of these in unchanged, as the baseline to beat. The rooms row above them is the lab's.
import { href } from "../../kit/address"
import type { Note } from "../../kit/contract"
import { PlacePage as BlendPlacePage } from "../blend/PlacePage"
import type { BlendData } from "../blend/loader.server"
import { DragProvider } from "../blend/parts"
import { Page as DialsPage, concept as dials } from "../dials"
import type { DialsData } from "../dials/loader.server"
import { Body as RoomsBody, concept as rooms } from "../rooms"
import type { RoomsData } from "../rooms/loader.server"
import type { PageViewProps } from "./contract"

/** A Rooms page (hub, a room, a place, Best). */
export const RoomsView = (props: PageViewProps<RoomsData>) => <RoomsBody {...props} />
export const roomsNotes = (props: PageViewProps<RoomsData>): Note[] =>
	(rooms.notes?.(props) ?? []).filter((n) => n.term !== "The rooms row")

/** A Dials page (hub, a family, a place, Best). Its Best tab is gone: Best sits in the rooms row. */
export const DialsView = (props: PageViewProps<DialsData>) => <DialsPage {...props} />
export const dialsNotes = (props: PageViewProps<DialsData>): Note[] =>
	(dials.notes?.(props) ?? []).filter((n) => n.term !== "Best")

/** Blend's place page: the title is the blend, the pantry adds, the Venn switches. */
export const BlendView = (props: PageViewProps<BlendData>) => (
	<DragProvider>
		<BlendPlacePage
			{...props}
			// The pantry's poster preview (`?peek=1`) is answered by the Blend concept's own loader, not the lab's.
			to={(a, extra) => (extra?.peek ? href("blend", a, extra) : props.to(a, extra))}
		/>
	</DragProvider>
)
