// PROTOTYPE - throwaway (#545). Variant A: the current CookieConsent banner, extended. Same box, same "We use
// cookies" title and Decline/Accept buttons, plus "Choose" with one toggle per vendor beside Analytics. A facade
// whose vendor is not allowed yet asks for that vendor right on the facade, and the answer is remembered.
// What production would store: the existing `cookie_consent` (yes/no, now meaning analytics) and a new
// `consent_embeds` map, in localStorage and in the member's user settings.
import { useState } from "react"
import { type Post, type TalkedAbout, VENDORS, VENDOR_KEYS, type Vendor } from "./data"
import { Artwork, LiveEmbed, PostCaption, StatePanel, TalkedAboutRow, VendorMark, useHydrated, useStored, usePlayer } from "./kit"

type Yn = "yes" | "no"
type Stored = { cookie_consent: Yn | "undecided"; consent_embeds: Partial<Record<Vendor, Yn>> }
const KEY = "proto-consent:A"
const EMPTY: Stored = { cookie_consent: "undecided", consent_embeds: {} }

export function VariantA() {
	const hydrated = useHydrated()
	const [stored, setStored] = useStored<Stored>(KEY, EMPTY)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const allow = (vendor: Vendor) =>
		setStored({ ...stored, consent_embeds: { ...stored.consent_embeds, [vendor]: "yes" } })
	const bannerVisible = hydrated && (stored.cookie_consent === "undecided" || settingsOpen)

	return (
		<>
			<StatePanel
				variant="A · Extend CookieConsent"
				question="Banner with per-vendor toggles; a facade click asks for that vendor and remembers it."
				cost="≈4.8 KB gzip own code (banner, facade, vendor marks, store); the banner part loads on every page's first view"
				analytics="Turns the dormant yes/no into a real analytics opt-in: PostHog, GA and Sentry replay would wait for “yes”"
				stored={hydrated ? stored : "…"}
				onReset={() => {
					localStorage.removeItem(KEY)
					location.reload()
				}}
				actions={
					<button
						type="button"
						onClick={() => setSettingsOpen(true)}
						className="rounded bg-neutral-800 px-2 py-1 font-semibold text-neutral-100 ring-1 ring-neutral-600 hover:bg-neutral-700"
					>
						Privacy settings
					</button>
				}
			/>
			<TalkedAboutRow
				renderPost={(post, title) => (
					<FacadeA post={post} title={title} allowed={hydrated && stored.consent_embeds[post.vendor] === "yes"} onAllow={() => allow(post.vendor)} />
				)}
				footer={
					<div className="px-4 text-xs text-neutral-500 sm:px-6">
						Posts load from YouTube, TikTok and Bluesky after you allow them.{" "}
						<button type="button" className="underline hover:text-neutral-300" onClick={() => setSettingsOpen(true)}>
							Privacy settings
						</button>
					</div>
				}
			/>
			{bannerVisible && (
				<BannerA
					stored={stored}
					startOpen={settingsOpen}
					onSave={(next) => {
						setStored(next)
						setSettingsOpen(false)
					}}
				/>
			)}
		</>
	)
}

function FacadeA({ post, title, allowed, onAllow }: { post: Post; title: TalkedAbout; allowed: boolean; onAllow: () => void }) {
	const player = usePlayer(post.id)
	const [asking, setAsking] = useState(false)
	const vendor = VENDORS[post.vendor]

	// Text posts show themselves once their vendor is allowed; videos still wait for a click.
	if (post.vendor === "bluesky" && allowed) return <LiveEmbed post={post} />
	if (post.vendor !== "bluesky" && player.live) return <LiveEmbed post={post} />

	const activate = () => (allowed ? player.start() : setAsking(true))
	const ask = asking && (
		<div className="absolute inset-0 z-10 flex flex-col justify-end gap-2 bg-black/85 p-3 text-sm text-neutral-200">
			<div className="flex items-center gap-2 font-semibold text-white">
				<VendorMark vendor={post.vendor} /> {post.vendor === "bluesky" ? "Show this post" : "Play this video"} from {vendor.name}?
			</div>
			<p className="text-xs leading-snug text-neutral-300">
				It loads from {vendor.host}, which gets your IP address and can set cookies.{" "}
				<a className="underline" href={vendor.privacy} target="_blank" rel="noreferrer noopener">
					{vendor.name}'s privacy policy
				</a>
			</p>
			<div className="flex gap-2">
				<button
					type="button"
					className="flex-1 rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-600"
					onClick={() => {
						onAllow()
						setAsking(false)
						if (post.vendor !== "bluesky") player.start()
					}}
				>
					Allow {vendor.name}
				</button>
				<button type="button" className="rounded-md bg-gray-800 px-3 py-1.5 ring-1 ring-inset ring-gray-600 hover:bg-gray-700" onClick={() => setAsking(false)}>
					Not now
				</button>
			</div>
		</div>
	)

	if (post.vendor === "bluesky")
		return (
			<div className="relative min-h-[132px] overflow-hidden rounded-xl bg-neutral-800/80 p-3 ring-1 ring-white/5">
				<div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
					<VendorMark vendor="bluesky" className="h-3.5 w-3.5" /> Bluesky
				</div>
				<PostCaption post={post} />
				<button type="button" onClick={activate} className="mt-3 rounded-md bg-neutral-700 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-600">
					Show post
				</button>
				{ask}
			</div>
		)

	return (
		<Artwork title={title} post={post}>
			<button type="button" onClick={activate} className="absolute inset-0 flex items-center justify-center" aria-label={`Play ${post.label}`}>
				<span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 ring-2 ring-white/70">
					<svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-white" aria-hidden="true">
						<path d="M8 5v14l11-7z" />
					</svg>
				</span>
			</button>
			<div className="pointer-events-none absolute inset-x-3 bottom-3">
				<PostCaption post={post} />
			</div>
			{ask}
		</Artwork>
	)
}

// The current component's box and buttons, with a "Choose" step added.
function BannerA({ stored, startOpen, onSave }: { stored: Stored; startOpen: boolean; onSave: (next: Stored) => void }) {
	const [choosing, setChoosing] = useState(startOpen)
	const [analytics, setAnalytics] = useState(stored.cookie_consent === "yes")
	const [embeds, setEmbeds] = useState<Partial<Record<Vendor, boolean>>>(
		Object.fromEntries(VENDOR_KEYS.map((v) => [v, stored.consent_embeds[v] === "yes"])),
	)
	const all = (value: Yn): Stored => ({
		cookie_consent: value,
		consent_embeds: Object.fromEntries(VENDOR_KEYS.map((v) => [v, value])),
	})
	const chosen = (): Stored => ({
		cookie_consent: analytics ? "yes" : "no",
		consent_embeds: Object.fromEntries(VENDOR_KEYS.map((v) => [v, embeds[v] ? "yes" : "no"])),
	})
	const Toggle = ({ on, set, label, detail, mark }: { on: boolean; set: (v: boolean) => void; label: string; detail: string; mark?: Vendor }) => (
		<label className="flex cursor-pointer items-center gap-3 py-2">
			<span className="flex min-w-0 flex-1 items-center gap-2">
				{mark && <VendorMark vendor={mark} />}
				<span className="min-w-0">
					<span className="block text-base">{label}</span>
					<span className="block text-xs text-gray-400">{detail}</span>
				</span>
			</span>
			<input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-5 w-5 accent-blue-600" />
		</label>
	)

	return (
		<div className="fixed bottom-0 left-1/2 z-200 w-full -translate-x-1/2 sm:max-w-4xl">
			<div className="m-2 rounded-lg border-4 border-slate-700 bg-slate-900 text-gray-200">
				<div className="flex h-14 items-center justify-between border-b border-slate-700 p-4 text-2xl">
					<h3 className="font-medium">We use cookies</h3>
					<span>🍪</span>
				</div>
				<div className="flex flex-col justify-between sm:flex-row">
					<div className="p-4">
						<p className="flex flex-col gap-2 text-base">
							<span>
								We use cookies to see how GoodWatch is used. Some posts play from YouTube, TikTok and Bluesky, which set their
								own cookies.
							</span>
							<a className="text-xs underline" href="/privacy">
								Learn more about our privacy policy
							</a>
						</p>
						{choosing && (
							<div className="mt-3 divide-y divide-slate-700 border-t border-slate-700">
								<Toggle on={analytics} set={setAnalytics} label="Analytics" detail="PostHog, Google Analytics, Sentry replays" />
								{VENDOR_KEYS.map((v) => (
									<Toggle
										key={v}
										mark={v}
										on={Boolean(embeds[v])}
										set={(on) => setEmbeds({ ...embeds, [v]: on })}
										label={VENDORS[v].name}
										detail={`${VENDORS[v].what}, loaded from ${VENDORS[v].host}`}
									/>
								))}
							</div>
						)}
					</div>
					<div className="flex flex-col items-center gap-3 bg-black/20 p-4 py-5 text-lg sm:min-w-56 sm:justify-end">
						<button type="button" className="w-full bg-gray-800 px-4 py-2 ring-1 ring-inset ring-gray-600 hover:bg-gray-700" onClick={() => onSave(all("no"))}>
							Decline
						</button>
						{choosing ? (
							<button type="button" className="w-full bg-gray-800 px-4 py-2 ring-1 ring-inset ring-gray-600 hover:bg-gray-700" onClick={() => onSave(chosen())}>
								Save choices
							</button>
						) : (
							<button type="button" className="w-full bg-gray-800 px-4 py-2 ring-1 ring-inset ring-gray-600 hover:bg-gray-700" onClick={() => setChoosing(true)}>
								Choose
							</button>
						)}
						<button type="button" className="w-full bg-blue-800 px-4 py-2 font-semibold ring-1 ring-inset ring-gray-600 hover:bg-blue-700" onClick={() => onSave(all("yes"))}>
							Accept all
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
