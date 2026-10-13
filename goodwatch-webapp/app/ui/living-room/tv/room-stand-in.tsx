// SEAM, a stand-in until slice 3: what the room needs from the TV before the machine (tv-machine.ts) and its
// hook (use-tv.ts) are there. It keeps the power, notes the last key and draws an empty TV that says what the
// room made of the window. The preview address uses it; slice 3 replaces both exports with `useTv` and
// `TvScreen` and deletes this file.
import { useCallback, useMemo, useState } from "react"
import { REMOTE_SERVICES } from "../living-room-data"
import type { RoomKey, RoomTv, TvCanvas } from "./room-tv"

const said = (key: RoomKey) => {
	switch (key.type) {
		case "move":
			return `move ${key.dir}`
		case "step":
			return `step ${key.by > 0 ? "on" : "back"}`
		case "service":
			return `only ${key.service}`
		case "power":
			return key.on ? "power on" : "power off"
		default:
			return key.type
	}
}

export function useRoomStandIn(): { tv: RoomTv; lastKey: string | null } {
	const [power, setPower] = useState<RoomTv["power"]>("on")
	const [lastKey, setLastKey] = useState<string | null>(null)
	const press = useCallback((key: RoomKey) => {
		setLastKey(said(key))
		if (key.type === "power") setPower(key.on ? "on" : "off")
	}, [])
	const tv = useMemo<RoomTv>(
		() => ({
			power,
			menuOpen: false,
			searching: false,
			activeService: null,
			serviceName: (key) =>
				REMOTE_SERVICES.find((service) => service.key === key)?.name ?? key,
			press,
		}),
		[power, press],
	)
	return { tv, lastKey }
}

/** The empty TV: no screen yet. It names its canvas, so a screenshot says how large the TV's type will print. */
export function EmptyTv({
	canvas,
	lastKey,
}: { canvas: TvCanvas; lastKey: string | null }) {
	const phone = canvas.edition === "phone"
	return (
		<div
			data-empty-tv
			data-last-key={lastKey ?? ""}
			className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(120%_120%_at_50%_0%,#1b2333_0%,#0b0e15_60%)] text-center"
		>
			<div
				className={`font-bold text-white/85 ${phone ? "text-[30px]" : "text-[54px]"}`}
			>
				No screen yet
			</div>
			<div
				className={`mt-2 text-white/60 ${phone ? "text-[20px]" : "text-[24px]"}`}
			>
				Canvas {canvas.w} x {Math.round(canvas.h)}, shown at{" "}
				{canvas.scale.toFixed(2)}: 20 px print at{" "}
				{(20 * canvas.scale).toFixed(1)}
			</div>
			<div
				className={`mt-1 text-white/60 ${phone ? "text-[20px]" : "text-[24px]"}`}
			>
				Last key: {lastKey ?? "none"}
			</div>
		</div>
	)
}
