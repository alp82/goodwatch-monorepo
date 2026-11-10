import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { setServerAssetBase } from "~/utils/asset-url"
import { StartRoom } from "./StartRoom"
import { startRoomPreloads } from "./room-pictures"

const render = (base: string) => {
	setServerAssetBase(() => base)
	return {
		preloads: startRoomPreloads(),
		html: renderToStaticMarkup(
			<MemoryRouter>
				<StartRoom night={0.55} camera={1} titles={[]} />
			</MemoryRouter>,
		),
	}
}
console.log(
	`__ROOM_RESOURCES__${JSON.stringify({
		origin: render(""),
		static: render("https://static.example.com"),
	})}`,
)
