// PROTOTYPE - throwaway (#545). Variant C: no banner change at all. The facade itself is the consent: it says where
// the video comes from, and the click on "Play from YouTube" is the consent for that one load. A checkbox under the
// button remembers the vendor, so its later facades play on the first click (and Bluesky posts show by themselves).
// What production would store: a `consent_embeds` list in localStorage (and the member's user settings) only.
import { useState } from "react"
import { type Post, type TalkedAbout, VENDORS, VENDOR_KEYS, type Vendor } from "./data"
import { Artwork, LiveEmbed, PostCaption, StatePanel, TalkedAboutRow, VendorMark, useHydrated, usePlayer, useStored } from "./kit"

type Stored = { remembered: Vendor[] }
const KEY = "proto-consent:C"
const EMPTY: Stored = { remembered: [] }

export function VariantC() {
	const hydrated = useHydrated()
	const [stored, setStored] = useStored<Stored>(KEY, EMPTY)
	const remembered = hydrated ? stored.remembered : []
	const setRemembered = (vendor: Vendor, on: boolean) =>
		setStored({ remembered: on ? [...new Set([...remembered, vendor])] : remembered.filter((v) => v !== vendor) })

	return (
		<>
			<StatePanel
				variant="C · Facade only"
				question="No banner. The click on the facade is the consent; a checkbox remembers the vendor."
				cost="≈3.9 KB gzip own code (facade, vendor marks, store); only where embeds are, nothing site-wide"
				analytics="Untouched: analytics keep loading as today, without asking (a separate question)"
				stored={hydrated ? stored : "…"}
				onReset={() => {
					localStorage.removeItem(KEY)
					location.reload()
				}}
			/>
			<TalkedAboutRow
				renderPost={(post, title) => (
					<FacadeC post={post} title={title} remembered={remembered.includes(post.vendor)} setRemembered={(on) => setRemembered(post.vendor, on)} />
				)}
				footer={
					remembered.length > 0 && (
						<div className="flex flex-wrap items-center gap-2 px-4 text-xs text-neutral-500 sm:px-6">
							Always loads here:
							{VENDOR_KEYS.filter((v) => remembered.includes(v)).map((v) => (
								<button
									key={v}
									type="button"
									onClick={() => setRemembered(v, false)}
									className="flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300 hover:bg-neutral-700"
									title={`Stop loading ${VENDORS[v].name} without asking`}
								>
									<VendorMark vendor={v} className="h-3 w-3" /> {VENDORS[v].name} ✕
								</button>
							))}
						</div>
					)
				}
			/>
		</>
	)
}

function FacadeC({
	post,
	title,
	remembered,
	setRemembered,
}: { post: Post; title: TalkedAbout; remembered: boolean; setRemembered: (on: boolean) => void }) {
	const player = usePlayer(post.id)
	const [shown, setShown] = useState(false)
	const [remember, setRemember] = useState(false)
	const vendor = VENDORS[post.vendor]
	const text = post.vendor === "bluesky"

	if (text && (remembered || shown)) return <LiveEmbed post={post} />
	if (!text && player.live) return <LiveEmbed post={post} />

	const load = () => {
		if (remember) setRemembered(true)
		if (text) setShown(true)
		else player.start()
	}

	return (
		<div className="overflow-hidden rounded-xl bg-neutral-800/80 ring-1 ring-white/5">
			{text ? (
				<div className="p-3 pb-0">
					<div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
						<VendorMark vendor="bluesky" className="h-3.5 w-3.5" /> Bluesky
					</div>
					<PostCaption post={post} />
				</div>
			) : (
				<Artwork title={title} post={post} className="rounded-b-none">
					<div className="pointer-events-none absolute inset-x-3 bottom-3">
						<PostCaption post={post} />
					</div>
				</Artwork>
			)}
			<div className="p-3">
				<button
					type="button"
					onClick={load}
					className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-black hover:bg-neutral-200"
				>
					{!text && (
						<svg viewBox="0 0 24 24" className="h-4 w-4 fill-black" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					)}
					{text ? "Show post" : "Play"} from {vendor.name}
				</button>
				{remembered ? (
					<p className="mt-2 text-[11px] text-neutral-400">You let {vendor.name} load on GoodWatch.</p>
				) : (
					<>
						<p className="mt-2 text-[11px] leading-snug text-neutral-400">
							Loads from {vendor.host}, which gets your IP address and can set cookies.{" "}
							<a className="underline" href={vendor.privacy} target="_blank" rel="noreferrer noopener">
								Privacy
							</a>
						</p>
						<label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-neutral-200">
							<input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-amber-500" />
							Remember for {vendor.name}
						</label>
					</>
				)}
			</div>
		</div>
	)
}
