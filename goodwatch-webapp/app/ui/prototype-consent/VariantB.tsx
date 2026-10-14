// PROTOTYPE - throwaway (#545). Variant B: orestbida's vanilla-cookieconsent v3 (banner + preferences, three
// categories) with iframemanager (the facades). Wired the way the two libraries' own demo wires them: a service
// accepted in the preferences loads its iframes, and "Always allow" on a facade accepts the service in the consent
// cookie. Both libraries write the DOM themselves, so React only renders empty placeholders for them.
// What production would store: the library's cookie (categories + services) and one cookie per accepted service.
import { useEffect, useState } from "react"
import { TALKED_ABOUT, TMDB_IMAGE, VENDORS, VENDOR_KEYS, type Vendor } from "./data"
import { StatePanel, TalkedAboutRow } from "./kit"

const CC_COOKIE = "proto_cc_B"
const imCookie = (vendor: Vendor) => `proto_im_${vendor}`

type CC = typeof import("vanilla-cookieconsent")
type IM = {
	run: (config: unknown) => void
	acceptService: (name: string) => void
	rejectService: (name: string) => void
	reset: (hard?: boolean) => void
	getState: () => { acceptedServices: string[] }
}
declare global {
	interface Window {
		iframemanager?: () => IM
	}
}

let libs: { cc: CC; im: IM } | null = null

const readCookie = (name: string) => {
	const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))
	return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function useLibraries() {
	useEffect(() => {
		let alive = true
		let started: { cc: CC; im: IM } | null = null
		document.documentElement.classList.add("cc--darkmode")
		;(async () => {
			const cc = await import("vanilla-cookieconsent")
			// @ts-expect-error The package ships no types; it registers window.iframemanager.
			await import("@orestbida/iframemanager")
			if (!alive || !window.iframemanager) return
			const im = window.iframemanager()
			started = libs = { cc, im }

			im.run({
				currLang: "en",
				onChange: ({ changedServices, eventSource }: { changedServices: string[]; eventSource: { type: string } }) => {
					if (eventSource.type !== "click") return
					const accepted = cc.getUserPreferences().acceptedServices.embeds ?? []
					cc.acceptService([...accepted, ...changedServices], "embeds")
				},
				services: Object.fromEntries(
					VENDOR_KEYS.map((vendor) => [
						vendor,
						{
							embedUrl:
								vendor === "youtube"
									? "https://www.youtube-nocookie.com/embed/{data-id}"
									: vendor === "tiktok"
										? "https://www.tiktok.com/player/v1/{data-id}"
										: "https://embed.bsky.app/embed/{data-id}",
							iframe: {
								allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
								referrerpolicy: "strict-origin-when-cross-origin",
								params: vendor === "youtube" ? "rel=0&playsinline=1" : vendor === "tiktok" ? "rel=0&description=1&music_info=1" : "",
							},
							cookie: { name: imCookie(vendor) },
							languages: {
								en: {
									notice: `Plays from ${VENDORS[vendor].name} (${VENDORS[vendor].host}), which gets your IP address and can set cookies. <a rel="noreferrer noopener" target="_blank" href="${VENDORS[vendor].privacy}">Privacy</a>`,
									loadBtn: vendor === "bluesky" ? "Show once" : "Load once",
									loadAllBtn: "Always allow",
								},
							},
						},
					]),
				),
			})

			cc.run({
				cookie: { name: CC_COOKIE },
				// The library hides itself from browsers that report automation (navigator.webdriver), which includes the
				// headless browser that takes this prototype's screenshots. Production would keep the default (true).
				hideFromBots: false,
				guiOptions: {
					consentModal: { layout: "box wide", position: "bottom right" },
					preferencesModal: { layout: "box" },
				},
				categories: {
					necessary: { enabled: true, readOnly: true },
					analytics: {
						services: {
							posthog: { label: "PostHog" },
							ga: { label: "Google Analytics" },
							sentry: { label: "Sentry session replay" },
						},
					},
					embeds: {
						services: Object.fromEntries(
							VENDOR_KEYS.map((vendor) => [
								vendor,
								{
									label: `${VENDORS[vendor].name} · ${VENDORS[vendor].what.toLowerCase()}`,
									onAccept: () => im.acceptService(vendor),
									onReject: () => im.rejectService(vendor),
								},
							]),
						),
					},
				},
				language: {
					default: "en",
					translations: {
						en: {
							consentModal: {
								title: "We use cookies",
								description:
									"We use cookies to see how GoodWatch is used. Some posts play from YouTube, TikTok and Bluesky, which set their own cookies.",
								acceptAllBtn: "Accept all",
								acceptNecessaryBtn: "Decline",
								showPreferencesBtn: "Choose",
								footer: '<a href="/privacy">Privacy policy</a>',
							},
							preferencesModal: {
								title: "Privacy settings",
								acceptAllBtn: "Accept all",
								acceptNecessaryBtn: "Decline all",
								savePreferencesBtn: "Save choices",
								closeIconLabel: "Close",
								sections: [
									{ title: "Necessary", description: "Sign-in and your settings.", linkedCategory: "necessary" },
									{ title: "Analytics", description: "How GoodWatch is used: PostHog, Google Analytics, Sentry replays.", linkedCategory: "analytics" },
									{
										title: "Posts from other sites",
										description: "Trailers, short videos and posts load from YouTube, TikTok and Bluesky once you allow them.",
										linkedCategory: "embeds",
									},
								],
							},
						},
					},
				},
			})
		})()
		return () => {
			alive = false
			document.documentElement.classList.remove("cc--darkmode")
			if (started) {
				started.im.reset(true)
				started.cc.reset()
				libs = null
			}
		}
	}, [])

	// Bluesky's widget reports its height; iframemanager gives the box a fixed one, so follow the report.
	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== "https://embed.bsky.app" || !event.data?.id || !event.data.height) return
			const box = document.querySelector<HTMLElement>(`[data-bsky-frame="${event.data.id}"]`)
			if (box) box.style.height = `${event.data.height}px`
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [])
}

function useLibraryState() {
	const [state, setState] = useState<unknown>("…")
	useEffect(() => {
		const read = () => {
			const raw = readCookie(CC_COOKIE)
			const cookie = raw ? JSON.parse(raw) : null
			setState({
				[CC_COOKIE]: cookie ? { categories: cookie.categories, services: cookie.services } : null,
				...Object.fromEntries(VENDOR_KEYS.map((v) => [imCookie(v), readCookie(imCookie(v))]).filter(([, v]) => v)),
			})
		}
		read()
		const timer = setInterval(read, 500)
		return () => clearInterval(timer)
	}, [])
	return state
}

export function VariantB() {
	useLibraries()
	const stored = useLibraryState()
	const bluesky = new Map(TALKED_ABOUT.flatMap((t) => t.posts).filter((p) => p.vendor === "bluesky").map((p, i) => [p.id, `b${i}`]))

	return (
		<>
			<StatePanel
				variant="B · vanilla-cookieconsent + iframemanager"
				question="The libraries' own banner, preferences and facades, themed dark. “Always allow” on a facade accepts the vendor in the consent cookie."
				cost="≈23.6 KB gzip: cookieconsent 10.2 JS + 5.3 CSS on every page's first view; iframemanager 3.1 JS + 2.0 CSS, glue 2.7, theme 0.4"
				analytics="Same as A, with the library as the source of truth: telemetry waits for the “analytics” category"
				stored={stored}
				onReset={() => {
					libs?.cc.reset(true)
					for (const v of VENDOR_KEYS) document.cookie = `${imCookie(v)}=; max-age=0; path=/`
					document.cookie = `${CC_COOKIE}=; max-age=0; path=/`
					location.reload()
				}}
				actions={
					<button
						type="button"
						onClick={() => libs?.cc.showPreferences()}
						className="rounded bg-neutral-800 px-2 py-1 font-semibold text-neutral-100 ring-1 ring-neutral-600 hover:bg-neutral-700"
					>
						Privacy settings
					</button>
				}
			/>
			<TalkedAboutRow
				renderPost={(post, title) => {
					const thumbnail = `${TMDB_IMAGE}/${post.vendor === "tiktok" ? `w342${title.posterPath}` : `w780${title.backdropPath}`}`
					const name = `${post.label} · ${post.author}`
					if (post.vendor === "bluesky") {
						const frame = bluesky.get(post.id) ?? ""
						return (
							<div
								className="im-box rounded-xl"
								data-service="bluesky"
								data-id={post.uri}
								data-title={name}
								data-params={`id=${frame}&colorMode=dark`}
								data-widget
								data-bsky-frame={frame}
								style={{ width: "100%", height: 230 }}
							/>
						)
					}
					return (
						<div
							className="im-box rounded-xl"
							data-service={post.vendor}
							data-id={post.vendor === "youtube" ? post.videoId : post.postId}
							data-title={name}
							data-thumbnail={thumbnail}
							data-autoscale
							data-ratio={post.vendor === "tiktok" ? "9:16" : "16:9"}
						/>
					)
				}}
			/>
		</>
	)
}
