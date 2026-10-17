// PROTOTYPE - throwaway. Round 2: three takes on B (invite card + link columns), each with its own motion flavor.
// F Spotlight rows, G Bento panels, H Glide. All share the invite card and the "made by" line.
import { ArrowRightIcon, ArrowUpRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { GoodWatchG, GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import {
	CountUp,
	Decrypt,
	EffectStyles,
	Magnet,
	Marquee,
	OrbitBorder,
	Reveal,
	Sheen,
	Spotlight,
	TiltCard,
	useInView,
	useReducedMotion,
} from "./effects"
import { Avatar, Credits, DISCORD_URL, DockSpacer, RICH, type RichLink, XMark, X_URL, Year } from "./shared"

const CHANNELS = ["main-chat", "recommend-me", "feedback"]

function Wordmark({ size = 30 }: { size?: number }) {
	return (
		<Link to="/" prefetch="intent" aria-label="GoodWatch home" className="inline-flex">
			<GoodWatchWordmark fontSize={size} />
		</Link>
	)
}

/** Any footer link: a router Link inside the site, a new tab outside it. */
function Go({ link, className, children, ...rest }: { link: RichLink; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
	return link.external ? (
		<a href={link.href} target="_blank" rel="noreferrer" className={className} {...rest}>
			{children}
		</a>
	) : (
		<Link to={link.href} prefetch="intent" className={className} {...rest}>
			{children}
		</Link>
	)
}

/** Cycles the "active" channel every few seconds, as if people were talking there. */
function useActiveChannel(run: boolean) {
	const [i, setI] = useState(0)
	const reduced = useReducedMotion()
	useEffect(() => {
		if (!run || reduced) return
		const id = window.setInterval(() => setI((n) => (n + 1) % CHANNELS.length), 2600)
		return () => window.clearInterval(id)
	}, [run, reduced])
	return i
}

function TypingDots() {
	return (
		<span className="flex gap-0.5" aria-hidden>
			{[0, 160, 320].map((d) => (
				<span key={d} className="h-1 w-1 animate-bounce rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />
			))}
		</span>
	)
}

function JoinButton({ className = "" }: { className?: string }) {
	return (
		<Magnet strength={0.18} className="w-full">
			<a
				href={DISCORD_URL}
				target="_blank"
				rel="noreferrer"
				className={`group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#248046] font-bold text-white shadow-[0_10px_30px_-10px_rgba(36,128,70,0.8)] transition-colors hover:bg-[#1f6f3d] ${className}`}
			>
				<Sheen />
				<span className="relative">Join the chat</span>
				<ArrowRightIcon className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
			</a>
		</Magnet>
	)
}

/** The Discord server invite. `layout`: channel pills in a row, or a channel sidebar list. */
function InviteCard({ show, layout = "pills", members, people }: { show: boolean; layout?: "pills" | "list"; members?: boolean; people?: boolean }) {
	const active = useActiveChannel(show)
	return (
		<div className="flex h-full flex-col rounded-2xl bg-[#2b2d31] p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
			<p className="mb-3 text-[11px] font-bold tracking-wider text-gray-400 uppercase">You're invited to join a server</p>
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
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
								<span className="relative h-2 w-2 rounded-full bg-emerald-400" />
							</span>
							Online now
						</span>
						<span className="flex items-center gap-1.5">
							<span className="h-2 w-2 rounded-full bg-gray-500" />
							{members ? <CountUp to={100} show={show} suffix="+" /> : "100+"} members
						</span>
					</p>
				</div>
			</div>

			{layout === "pills" ? (
				<div className="mt-4 flex flex-wrap gap-1.5">
					{CHANNELS.map((c, i) => (
						<span key={c} className="relative rounded-md px-2 py-1 text-xs">
							{i === active && (
								<motion.span layoutId="proto-chan" className="absolute inset-0 rounded-md bg-[#5865F2]/30 ring-1 ring-[#5865F2]/60" transition={{ type: "spring", bounce: 0.25, duration: 0.5 }} />
							)}
							{i !== active && <span className="absolute inset-0 rounded-md bg-white/[0.06]" />}
							<span className={`relative flex items-center gap-1.5 transition-colors ${i === active ? "text-white" : "text-gray-300"}`}>
								<span className="text-gray-500">#</span>
								{c}
								{i === active && <TypingDots />}
							</span>
						</span>
					))}
				</div>
			) : (
				<ul className="mt-4 flex flex-col gap-0.5 rounded-lg bg-black/20 p-1.5">
					{CHANNELS.map((c, i) => (
						<li key={c} className="relative flex h-8 items-center gap-2 rounded-md px-2 text-sm">
							{i === active && <motion.span layoutId="proto-chan-list" className="absolute inset-0 rounded-md bg-white/[0.08]" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
							<span className="relative text-lg leading-none text-gray-500">#</span>
							<span className={`relative transition-colors ${i === active ? "font-semibold text-white" : "text-gray-400"}`}>{c}</span>
							<span className="relative ml-auto flex items-center gap-1.5 text-[11px] text-gray-400">
								<AnimatePresence>
									{i === active && (
										<motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
											<Avatar index={i + 1} size={16} ring="ring-transparent" />
											<TypingDots />
										</motion.span>
									)}
								</AnimatePresence>
							</span>
						</li>
					))}
				</ul>
			)}
			{people && (
				<div className="mt-4 flex items-center gap-3 rounded-lg bg-black/20 p-2.5">
					<span className="flex -space-x-2">
						{[0, 1, 2, 3].map((i) => (
							<span key={i} style={{ animation: show ? `proto-pop 0.5s ${0.5 + i * 0.08}s both` : undefined }}>
								<Avatar index={i} size={26} ring="ring-[#2b2d31]" />
							</span>
						))}
					</span>
					<p className="text-xs leading-snug text-gray-400">Ask for picks, share finds, and help decide what gets built next.</p>
				</div>
			)}
			<div className="mt-auto pt-4">
				<JoinButton />
			</div>
		</div>
	)
}

function MadeBy() {
	const [hover, setHover] = useState(false)
	return (
		<a
			href={X_URL}
			target="_blank"
			rel="noreferrer"
			onPointerEnter={() => setHover(true)}
			onPointerLeave={() => setHover(false)}
			onFocus={() => setHover(true)}
			onBlur={() => setHover(false)}
			className="group inline-flex items-center gap-2 rounded-full bg-white/[0.05] py-1 pr-3 pl-1 text-xs text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.1] hover:text-white"
		>
			<span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:rotate-[360deg]">
				<XMark className="h-3 w-3" />
			</span>
			<span>
				Created by <span className="text-gray-200 group-hover:text-amber-300">
					<Decrypt text="@alperortac" active={hover} />
				</span>
			</span>
		</a>
	)
}

function BottomBar() {
	return (
		<div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-4 border-t border-white/[0.07] px-4 py-6 text-xs text-gray-500 sm:flex-row sm:px-6 lg:px-8">
			<span className="flex items-center gap-4">
				<Year />
				<Credits />
			</span>
			<MadeBy />
		</div>
	)
}

/* ------------------------------------------------------------------ F: Spotlight rows */
// B's layout. Each link is a row with an icon and a one-line blurb. An amber glow follows the pointer
// across the whole link area, columns rise in one after another, and the invite card tilts toward the pointer.
function RowLink({ link }: { link: RichLink }) {
	const Icon = link.icon
	return (
		<Go link={link} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
			<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] sm:h-9 sm:w-9 text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-[transform,background-color,color] duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-amber-400/15 group-hover:text-amber-300">
				<Icon className="h-[18px] w-[18px]" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-center gap-1 text-sm font-medium text-gray-200 transition-colors group-hover:text-white">
					{link.name}
					{link.external && <ArrowUpRightIcon className="h-3.5 w-3.5 text-gray-500" />}
				</span>
				<span className="hidden truncate text-xs text-gray-500 sm:block">{link.blurb}</span>
			</span>
			<ArrowRightIcon className="h-4 w-4 shrink-0 -translate-x-2 text-amber-300 opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
		</Go>
	)
}

export function VariantF() {
	const [ref, show] = useInView<HTMLElement>()
	return (
		<footer ref={ref} className="mt-40 bg-gradient-to-b from-transparent to-gray-950">
			<EffectStyles />
			<Spotlight className="mx-auto max-w-7xl" size={560}>
				<div className="grid gap-12 px-4 pt-12 pb-12 sm:px-6 lg:grid-cols-[1fr_380px] lg:gap-16 lg:px-8">
					<div className="flex flex-col gap-10">
						<Reveal show={show}>
							<Wordmark size={34} />
							<p className="mt-3 max-w-md text-[15px] leading-relaxed text-gray-400">Every score, every service, one place.</p>
						</Reveal>
						<div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
							{RICH.map((col, ci) => (
								<Reveal key={col.title} show={show} delay={120 + ci * 110}>
									<h3 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-gray-500 uppercase">
										<col.icon className="h-3.5 w-3.5 text-amber-400/70" />
										{col.title}
									</h3>
									<ul className="flex flex-col gap-0.5">
										{col.links.map((l) => (
											<li key={l.name}>
												<RowLink link={l} />
											</li>
										))}
									</ul>
								</Reveal>
							))}
						</div>
					</div>
					<Reveal show={show} delay={420} className="self-start">
						<TiltCard className="rounded-2xl">
							<InviteCard show={show} />
						</TiltCard>
					</Reveal>
				</div>
			</Spotlight>
			<BottomBar />
			<DockSpacer />
		</footer>
	)
}

/* ------------------------------------------------------------------ G: Bento panels */
// The three categories become panels in a bento grid next to the invite card. Links are small tiles that lift
// on hover, each panel has its own pointer glow, a light orbits the invite card's rim, and the member count counts up.
function TileLink({ link, i, show, wide }: { link: RichLink; i: number; show: boolean; wide?: boolean }) {
	const Icon = link.icon
	return (
		<Reveal show={show} delay={200 + i * 45} y={10} className={wide ? "col-span-2" : ""}>
			<Go
				link={link}
				className="group flex h-full items-center gap-2.5 rounded-xl bg-white/[0.03] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition-[transform,background-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35),0_12px_24px_-12px_rgba(0,0,0,0.8)]"
			>
				<Icon className="h-[18px] w-[18px] shrink-0 text-gray-500 transition-[color,transform] duration-300 group-hover:scale-110 group-hover:text-amber-300" />
				<span className="min-w-0">
					<span className="block truncate text-sm font-medium text-gray-200 group-hover:text-white">{link.name}</span>
					<span className="block truncate text-[11px] text-gray-500">{link.blurb}</span>
				</span>
			</Go>
		</Reveal>
	)
}

export function VariantG() {
	const [ref, show] = useInView<HTMLElement>()
	let n = 0
	return (
		<footer ref={ref} className="mt-40 bg-gradient-to-b from-transparent to-gray-950">
			<EffectStyles />
			<div className="mx-auto max-w-7xl px-4 pt-12 pb-12 sm:px-6 lg:px-8">
				<Reveal show={show} className="mb-8 flex flex-wrap items-end justify-between gap-4">
					<div>
						<Wordmark size={34} />
						<p className="mt-3 text-[15px] text-gray-400">Every score, every service, one place.</p>
					</div>
				</Reveal>
				<div className="grid gap-4 lg:grid-cols-[1fr_1fr_380px]">
					{RICH.map((col, ci) => (
						<Spotlight
							key={col.title}
							color="rgba(251,191,36,0.09)"
							size={360}
							className={`rounded-2xl bg-white/[0.02] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ${ci === 2 ? "lg:col-span-3" : ""}`}
						>
							<h3 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-gray-500 uppercase">
								<span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/10">
									<col.icon className="h-3.5 w-3.5 text-amber-300" />
								</span>
								{col.title}
							</h3>
							<div className={`grid gap-2 ${ci === 2 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2"}`}>
								{col.links.map((l, li) => (
									<TileLink key={l.name} link={l} i={n++} show={show} wide={ci < 2 && li === col.links.length - 1 && col.links.length % 2 === 1} />
								))}
							</div>
						</Spotlight>
					))}
					<Reveal show={show} delay={300} className="lg:col-start-3 lg:row-start-1">
						<OrbitBorder className="h-full rounded-2xl" inner="h-full bg-[#2b2d31]">
							<InviteCard show={show} members people />
						</OrbitBorder>
					</Reveal>
				</div>
			</div>
			<BottomBar />
			<DockSpacer />
		</footer>
	)
}

/* ------------------------------------------------------------------ H: Glide */
// Plain link lists, but one highlight glides between whatever link you point at, and a caption over the lists
// tells you where it goes. The invite card floats, with Discord's own channel list. A slow tagline strip
// and a huge faint wordmark close the page.
export function VariantH() {
	const [ref, show] = useInView<HTMLElement>()
	const [hovered, setHovered] = useState<RichLink | null>(null)
	return (
		<footer ref={ref} className="relative mt-40 shrink-0 overflow-hidden bg-gradient-to-b from-transparent via-gray-950 to-black">
			<EffectStyles />
			<div className="mx-auto grid max-w-7xl gap-12 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:gap-16 lg:px-8">
				<div>
					<Reveal show={show}>
						<Wordmark size={34} />
					</Reveal>
					<div className="mt-3 h-6 text-[15px] text-gray-400" aria-live="polite">
						<AnimatePresence mode="wait" initial={false}>
							<motion.p
								key={hovered?.name ?? "tag"}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18 }}
								className="flex items-center gap-2"
							>
								{hovered ? (
									<>
										<hovered.icon className="h-4 w-4 text-amber-300" />
										<span className="text-gray-200">{hovered.name}</span>
										<span className="text-gray-600">·</span>
										{hovered.blurb}
									</>
								) : (
									"Every score, every service, one place."
								)}
							</motion.p>
						</AnimatePresence>
					</div>

					<nav aria-label="Footer" className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3" onPointerLeave={() => setHovered(null)}>
						{RICH.map((col, ci) => (
							<Reveal key={col.title} show={show} delay={100 + ci * 110}>
								<h3 className="mb-2 text-xs font-bold tracking-wider text-gray-500 uppercase">{col.title}</h3>
								<ul className="flex flex-col">
									{col.links.map((l) => (
										<li key={l.name}>
											<Go
												link={l}
												onPointerEnter={() => setHovered(l)}
												onFocus={() => setHovered(l)}
												onBlur={() => setHovered(null)}
												className="relative -mx-3 flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-gray-400 transition-colors hover:text-white focus-visible:text-white"
											>
												{hovered?.name === l.name && (
													<motion.span layoutId="proto-glide" className="absolute inset-0 rounded-lg bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" transition={{ type: "spring", bounce: 0.18, duration: 0.4 }} />
												)}
												<l.icon className={`relative h-4 w-4 transition-colors ${hovered?.name === l.name ? "text-amber-300" : "text-gray-600"}`} />
												<span className="relative">{l.name}</span>
												{l.external && <ArrowUpRightIcon className="relative h-3.5 w-3.5 text-gray-600" />}
											</Go>
										</li>
									))}
								</ul>
							</Reveal>
						))}
					</nav>
				</div>
				<Reveal show={show} delay={380} className="self-start">
					<div className="motion-safe:[animation:proto-float_6s_ease-in-out_infinite]">
						<InviteCard show={show} layout="list" />
					</div>
				</Reveal>
			</div>

			<Marquee seconds={50} className="border-y border-white/[0.06] py-3 text-sm text-gray-500">
				{["Every score", "Every service", "One place", "Join the chat", "Made for people who read every score twice"].map((t) => (
					<span key={t} className="flex items-center gap-6 pr-6 whitespace-nowrap">
						{t}
						<GoodWatchG height={12} color="#fbbf24" />
					</span>
				))}
			</Marquee>

			<BottomBar />

			<div aria-hidden className="pointer-events-none -mt-4 flex justify-center overflow-hidden opacity-[0.05] select-none">
				<div className="translate-y-[30%]">
					<GoodWatchWordmark fontSize={220} />
				</div>
			</div>
			<DockSpacer />
		</footer>
	)
}

export const FOOTER_VARIANTS_2: Record<string, string> = {
	F: "Spotlight rows",
	G: "Bento panels",
	H: "Glide",
}
