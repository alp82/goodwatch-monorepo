// How a card's Seen control looks: a show's status (or Not started), else a movie's Seen. Shared by the pointer panel
// (CardActions) and the touch band (TapBand).
import {
	EyeIcon,
	EyeSlashIcon,
	PauseIcon,
	PlayIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { STATUS_LOOK } from "~/ui/tracking/status-look"
import type { WatchStatus } from "./marks"

const STATUS_ICON: Record<WatchStatus, typeof PlayIcon> = {
	watching: PlayIcon,
	on_hold: PauseIcon,
	dropped: XMarkIcon,
	seen: EyeIcon,
}

/** Seen's face: its icon, the icon's tint while off, whether it is on, and its filled look when on. */
export function seenFaceOf(
	isShow: boolean,
	status: WatchStatus | null,
	seen: boolean,
) {
	if (isShow && status)
		return {
			Icon: STATUS_ICON[status],
			tint: "",
			on: true,
			cls: STATUS_LOOK[status].pill,
		}
	if (isShow)
		return { Icon: EyeSlashIcon, tint: "text-gray-400", on: false, cls: "" }
	return {
		Icon: EyeIcon,
		tint: "text-green-300",
		on: seen,
		cls: STATUS_LOOK.seen.pill,
	}
}
