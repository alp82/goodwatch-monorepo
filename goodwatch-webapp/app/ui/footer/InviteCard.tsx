// The footer's Discord invite, shaped like Discord's own server invite: the white G, the channel list, and a join
// button. While the card is on screen, the highlight moves from channel to channel as if people were talking there.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import avatars from "~/img/avatars/avatars.svg"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { assetUrl } from "~/utils/asset-url"
import { DISCORD_URL } from "./links"
import { Magnet, Sheen, usePrefersReducedMotion } from "./motion"

const CHANNELS = ["main-chat", "recommend-me", "feedback"]
// A channel row is h-8 with a 2px gap: the highlight moves by this much per row.
const ROW_STEP_PX = 34
const AVATAR_POSITIONS = ["0", "33.33%", "66.67%", "100%"]

function TypingDots() {
	return (
		<span className="flex gap-0.5" aria-hidden>
			{[0, 160, 320].map((delay) => (
				<span
					key={delay}
					className="h-1 w-1 animate-bounce rounded-full bg-current"
					style={{ animationDelay: `${delay}ms` }}
				/>
			))}
		</span>
	)
}

export function InviteCard({ active }: { active: boolean }) {
	const reduced = usePrefersReducedMotion()
	const [channel, setChannel] = useState(0)
	useEffect(() => {
		if (!active || reduced) return
		const timer = window.setInterval(
			() => setChannel((n) => (n + 1) % CHANNELS.length),
			2600,
		)
		return () => window.clearInterval(timer)
	}, [active, reduced])

	return (
		<div className="flex flex-col rounded-2xl bg-[#2b2d31] p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
			<p className="mb-3 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
				You're invited to join a server
			</p>
			<div className="flex items-center gap-3.5">
				<span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5865F2] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]">
					<GoodWatchG height={30} color="#ffffff" />
					<span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-[3px] border-[#2b2d31] bg-emerald-400" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate text-base font-bold text-white">GoodWatch</p>
					<p className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
						<span className="flex items-center gap-1.5">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
								<span className="relative h-2 w-2 rounded-full bg-emerald-400" />
							</span>
							Online now
						</span>
						<span className="flex items-center gap-1.5">
							<span className="h-2 w-2 rounded-full bg-gray-500" />
							100+ members
						</span>
					</p>
				</div>
			</div>

			<ul
				className="relative mt-4 flex flex-col gap-0.5 rounded-lg bg-black/20 p-1.5"
				aria-label="Channels"
			>
				<span
					aria-hidden
					className="absolute top-1.5 right-1.5 left-1.5 h-8 rounded-md bg-white/[0.08] transition-transform duration-500 ease-out-back"
					style={{ transform: `translate3d(0, ${channel * ROW_STEP_PX}px, 0)` }}
				/>
				{CHANNELS.map((name, i) => (
					<li
						key={name}
						className="relative flex h-8 items-center gap-2 px-2 text-sm"
					>
						<span className="text-lg leading-none text-gray-500">#</span>
						<span
							className={`transition-colors ${i === channel ? "font-semibold text-white" : "text-gray-400"}`}
						>
							{name}
						</span>
						{i === channel && (
							<span
								key={channel}
								className="footer-fade-in ml-auto flex items-center gap-1.5 text-[11px] text-gray-400"
								aria-hidden
							>
								<span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-gray-700">
									<img
										src={assetUrl(avatars)}
										alt=""
										width={16}
										height={16}
										loading="lazy"
										decoding="async"
										className="h-full w-full object-cover"
										style={{ objectPosition: AVATAR_POSITIONS[(i + 1) % 4] }}
									/>
								</span>
								<TypingDots />
							</span>
						)}
					</li>
				))}
			</ul>

			<Magnet className="mt-4">
				<a
					href={DISCORD_URL}
					target="_blank"
					rel="noreferrer"
					className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#248046] font-bold text-white shadow-[0_10px_30px_-10px_rgba(36,128,70,0.8)] transition-colors hover:bg-[#1f6f3d]"
				>
					<Sheen />
					<span className="relative">Join the chat</span>
					<ArrowRightIcon
						className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
						aria-hidden
					/>
				</a>
			</Magnet>
		</div>
	)
}
