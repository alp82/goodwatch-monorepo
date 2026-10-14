// The official players, mounted only after a click on a facade. Each is the vendor's own iframe: no vendor script runs
// on GoodWatch's page. Bluesky's and Mastodon's embed scripts only create this iframe and set its height from a
// message it posts; that part is done here, for messages from the iframe itself.
//
// Every frame sends the page's origin as its referrer (`strict-origin-when-cross-origin`): YouTube refuses to play an
// embed without one.
import { useEffect, useId, useRef, useState } from "react"
import type { EmbedTarget } from "./target"
import { REFERRER_POLICY, YouTubeFrame } from "./YouTubeFrame"

export { YouTubeFrame }

const BLUESKY_ORIGIN = "https://embed.bsky.app"

function BlueskyFrame({ did, rkey, title }: { did: string; rkey: string; title: string }) {
	// The frame posts { id, height } to the page whenever its content changes size.
	const id = useId().replace(/[^A-Za-z0-9]/g, "")
	const [height, setHeight] = useState(240)
	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== BLUESKY_ORIGIN || event.data?.id !== id) return
			const next = Number(event.data.height)
			if (next > 0 && next < 4000) setHeight(next)
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [id])
	const params = new URLSearchParams({ id, colorMode: "dark" })
	return (
		<iframe
			src={`${BLUESKY_ORIGIN}/embed/${did}/app.bsky.feed.post/${encodeURIComponent(rkey)}?${params}`}
			title={title}
			referrerPolicy={REFERRER_POLICY}
			scrolling="no"
			style={{ height }}
			className="block w-full max-w-[600px] border-0"
		/>
	)
}

function MastodonFrame({ embedUrl, origin, title }: { embedUrl: string; origin: string; title: string }) {
	// Mastodon's embed answers a { type: "setHeight", id } message with its height, and posts it again on resize.
	const frame = useRef<HTMLIFrameElement>(null)
	const id = useRef(Math.floor(Math.random() * 2 ** 31) + 1)
	const [height, setHeight] = useState(240)
	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const data = event.data
			if (event.source !== frame.current?.contentWindow || data?.type !== "setHeight" || data.id !== id.current) return
			const next = Number(data.height)
			if (next > 0 && next < 4000) setHeight(next)
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [])
	return (
		<iframe
			ref={frame}
			src={embedUrl}
			title={title}
			referrerPolicy={REFERRER_POLICY}
			sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
			allow="fullscreen"
			scrolling="no"
			style={{ height }}
			onLoad={() => frame.current?.contentWindow?.postMessage({ type: "setHeight", id: id.current }, origin)}
			className="block w-full max-w-[600px] rounded-lg border-0 bg-white"
		/>
	)
}

/** The official player of a target. A link target has none. */
export function SocialPlayer({ target, title }: { target: EmbedTarget; title: string }) {
	switch (target.kind) {
		case "youtube":
			return <YouTubeFrame videoId={target.videoId} vertical={target.vertical} title={title} />
		case "bluesky":
			return <BlueskyFrame did={target.did} rkey={target.rkey} title={title} />
		case "mastodon":
			return <MastodonFrame embedUrl={target.embedUrl} origin={target.origin} title={title} />
		default:
			return null
	}
}
