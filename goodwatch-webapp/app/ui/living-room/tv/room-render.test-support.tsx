// Run by room-render.test.ts through vite-node: renders the new room the way the server does and prints the
// HTML, and compares room-layout.ts's copies of the photo, hand and Remote numbers with room.ts's.
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { StartTitle } from "../living-room-data"
import {
	HAND as OLD_HAND,
	PHONE_LIP,
	PHONE_ROOM,
	REMOTE_H as OLD_REMOTE_H,
	REMOTE_TILT_DEG as OLD_TILT,
	REMOTE_W as OLD_REMOTE_W,
	ROOM,
} from "../room"
import { TvRoom } from "./TvRoom"
import {
	HAND,
	PHONE_ROOM_PHOTO,
	REMOTE_H,
	REMOTE_TILT_DEG,
	REMOTE_W,
	ROOM_PHOTO,
} from "./room-layout"
import type { RoomTv } from "./room-tv"

const titles: StartTitle[] = Array.from({ length: 16 }, (_, i) => ({
	media_type: i % 4 === 0 ? "movie" : "show",
	tmdb_id: 100 + i,
	title: `Title ${i + 1}`,
	release_year: 1990 + i,
	poster_path: `/poster${i}.jpg`,
}))

const tv: RoomTv = {
	power: "on",
	menuOpen: false,
	searching: false,
	activeService: null,
	serviceName: (key) => key,
	press: () => {},
}

const render = (power: RoomTv["power"]) =>
	renderToStaticMarkup(
		<MemoryRouter>
			<TvRoom
				tv={{ ...tv, power }}
				startTitles={titles}
				renderScreen={() => <div data-screen />}
			/>
		</MemoryRouter>,
	)

const photo = ({ w, h, tv: t }: typeof ROOM | typeof PHONE_ROOM) => ({
	w,
	h,
	tv: { ...t },
})

console.log(
	`__ROOM_RENDER__${JSON.stringify({
		on: render("on"),
		again: render("on"),
		off: render("off"),
		numbers: {
			layout: {
				room: ROOM_PHOTO,
				phoneRoom: PHONE_ROOM_PHOTO,
				hand: HAND,
				remote: [REMOTE_W, REMOTE_H],
				tilt: REMOTE_TILT_DEG,
			},
			room: {
				room: photo(ROOM),
				phoneRoom: photo(PHONE_ROOM),
				hand: OLD_HAND,
				remote: [OLD_REMOTE_W, OLD_REMOTE_H],
				tilt: OLD_TILT,
			},
			lip: PHONE_LIP,
		},
	})}`,
)
