// Sends a page's 103 Early Hints response before Remix renders it (what it says: early-hints.ts). The render and its
// loaders take most of the time to first byte; meanwhile the browser opens the connections to the static hostname and
// fetches the render-blocking style sheets, the brand font and the start page's room pictures. Both proxies in front of the webapp (Traefik 2.10 on abio, Traefik 3.6 on
// the second instance's host) forward a 103 as it comes, over HTTP/2 and HTTP/1.1 (tested October 18, 2026).
// Chrome uses Early Hints on HTTP/2 and HTTP/3 navigations; other browsers ignore them.
//
// Remix's request handler never sees Node's response, so this module wraps the server's request listeners as the page
// cache and the static files do. entry.server.tsx starts it after the page cache and before the static files: a page
// from the page cache gets its hints too, and a file request never gets here.
import { subscribe } from "node:diagnostics_channel"
import type { IncomingMessage, Server } from "node:http"
import gabaritoLatin from "~/fonts/gabarito-latin.woff2"
import cssTailwind from "~/tailwind.css?url"
import { HOME_SHEETS } from "~/ui/living-room/home-sheets"
import { HAND_IMAGE } from "~/ui/living-room/room"
import { PHONE_ROOM_ART, ROOM_ART } from "~/ui/living-room/tv/room-art"
import { currentAssetBase, isStaticHost } from "./asset-address.server"
import { earlyHintLinks } from "./early-hints"

const FILES = {
	site: cssTailwind,
	home: [...HOME_SHEETS],
	font: gabaritoLatin,
	room: {
		phone: [PHONE_ROOM_ART.avif, HAND_IMAGE.avif],
		desktop: [ROOM_ART.avif, HAND_IMAGE.avif],
	},
}

let started = false
const wrapped = new WeakSet<Server>()

export function startEarlyHints(): void {
	if (started) return
	started = true
	subscribe("http.server.request.start", (message) => {
		const { server, request } = message as {
			server: Server
			request: IncomingMessage
		}
		if (
			request.socket.localPort !== (Number(process.env.PORT) || 3000) ||
			wrapped.has(server)
		)
			return
		wrapped.add(server)
		const listeners = server.listeners("request")
		server.removeAllListeners("request")
		server.on("request", (request, response) => {
			// An HTTP/1.0 client doesn't know informational responses.
			if (
				request.httpVersion !== "1.0" &&
				!isStaticHost(request.headers.host)
			) {
				const link = earlyHintLinks(request, currentAssetBase(), FILES)
				if (link.length)
					try {
						response.writeEarlyHints({ link })
					} catch {
						// The page still answers without its hints.
					}
			}
			for (const listener of listeners)
				Reflect.apply(listener, server, [request, response])
		})
	})
}
