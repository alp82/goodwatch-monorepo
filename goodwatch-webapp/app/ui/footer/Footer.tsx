// The site footer: the wordmark with a caption that names the link under the pointer, four link columns that one
// highlight glides through, the Discord invite card, the credits, and a large faint wordmark that closes the page.
// The columns and the card rise into place the first time the footer scrolls into view.
import { ArrowUpRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useRef, useState } from "react"
import justwatchLogo from "~/img/justwatch-logo.svg"
import tmdbLogo from "~/img/tmdb-logo.svg"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { assetUrl } from "~/utils/asset-url"
import { InviteCard } from "./InviteCard"
import { CREATOR_URL, FOOTER_COLUMNS, type FooterLink, XMark } from "./links"
import { Reveal, ScrambleText, useFooterView } from "./motion"

const TAGLINE = "Every score, every service, one place."

function FooterNavLink({
	link,
	onPoint,
	className,
	children,
}: {
	link: FooterLink
	onPoint: (target: HTMLElement | null) => void
	className: string
	children: React.ReactNode
}) {
	const point = {
		onPointerEnter: (event: React.PointerEvent<HTMLElement>) =>
			onPoint(event.currentTarget),
		onFocus: (event: React.FocusEvent<HTMLElement>) =>
			onPoint(event.currentTarget),
		onBlur: () => onPoint(null),
	}
	return link.external ? (
		<a
			href={link.href}
			target="_blank"
			rel="noreferrer"
			className={className}
			{...point}
		>
			{children}
		</a>
	) : (
		<Link to={link.href} prefetch="intent" className={className} {...point}>
			{children}
		</Link>
	)
}

function CreatedBy() {
	const [active, setActive] = useState(false)
	return (
		<a
			href={CREATOR_URL}
			target="_blank"
			rel="noreferrer"
			onPointerEnter={() => setActive(true)}
			onPointerLeave={() => setActive(false)}
			onFocus={() => setActive(true)}
			onBlur={() => setActive(false)}
			className="group inline-flex items-center gap-2 rounded-full bg-white/[0.05] py-1 pr-3 pl-1 text-xs text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.1] hover:text-white"
		>
			<span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black transition-transform duration-500 group-hover:rotate-[360deg] motion-reduce:transition-none">
				<XMark className="h-3 w-3" />
			</span>
			<span>
				Created by{" "}
				<span className="text-gray-200 group-hover:text-amber-300">
					<ScrambleText text="@alperortac" active={active} />
				</span>
			</span>
		</a>
	)
}

function PoweredBy() {
	return (
		<span className="flex items-center gap-2 whitespace-nowrap">
			Powered by
			<a
				href="https://www.themoviedb.org"
				target="_blank"
				rel="noreferrer"
				className="opacity-70 transition-opacity hover:opacity-100"
			>
				<img alt="TMDB" className="h-2.5 w-auto" src={assetUrl(tmdbLogo)} />
			</a>
			and
			<a
				href="https://www.justwatch.com"
				target="_blank"
				rel="noreferrer"
				className="opacity-70 transition-opacity hover:opacity-100"
			>
				<img
					alt="JustWatch"
					className="h-3 w-auto"
					loading="lazy"
					src={assetUrl(justwatchLogo)}
				/>
			</a>
		</span>
	)
}

export default function Footer() {
	const { ref, hidden, onScreen } = useFooterView<HTMLElement>()
	const [pointed, setPointed] = useState<FooterLink | null>(null)
	const nav = useRef<HTMLElement>(null)
	const glide = useRef<HTMLSpanElement>(null)

	// One highlight glides to the link under the pointer. It appears in place, then slides between links.
	const pointAt = (link: FooterLink | null, target: HTMLElement | null) => {
		setPointed(link)
		const highlight = glide.current
		if (!highlight || !nav.current) return
		if (!target) {
			highlight.style.opacity = "0"
			return
		}
		const navBox = nav.current.getBoundingClientRect()
		const box = target.getBoundingClientRect()
		const appearing = highlight.style.opacity !== "1"
		if (appearing) highlight.style.transition = "none"
		highlight.style.width = `${box.width}px`
		highlight.style.height = `${box.height}px`
		highlight.style.transform = `translate3d(${box.left - navBox.left}px, ${box.top - navBox.top}px, 0)`
		if (appearing) {
			void highlight.offsetWidth
			highlight.style.transition = ""
		}
		highlight.style.opacity = "1"
	}

	return (
		<footer
			ref={ref}
			className="relative mt-40 shrink-0 overflow-hidden bg-gradient-to-b from-transparent via-gray-950 to-black"
		>
			<div className="mx-auto grid max-w-7xl gap-12 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:gap-16 lg:px-8">
				<div>
					<Reveal hidden={hidden}>
						<Link
							to="/"
							prefetch="intent"
							aria-label="GoodWatch home"
							className="inline-flex"
						>
							<GoodWatchWordmark fontSize={34} />
						</Link>
					</Reveal>
					<p
						key={pointed?.name ?? "tagline"}
						className="footer-caption mt-3 flex h-6 items-center gap-2 text-[15px] text-gray-400"
					>
						{pointed ? (
							<>
								<pointed.icon className="h-4 w-4 text-amber-300" aria-hidden />
								<span className="text-gray-200">{pointed.name}</span>
								<span className="text-gray-600" aria-hidden>
									·
								</span>
								{pointed.blurb}
							</>
						) : (
							TAGLINE
						)}
					</p>

					<nav
						ref={nav}
						aria-label="Footer"
						className="relative mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4"
						onPointerLeave={() => pointAt(null, null)}
					>
						<span
							ref={glide}
							aria-hidden
							className="pointer-events-none absolute top-0 left-0 rounded-lg bg-white/[0.07] opacity-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-[transform,opacity] duration-300 ease-out-back motion-reduce:transition-none"
						/>
						{FOOTER_COLUMNS.map((column, i) => (
							<Reveal key={column.title} hidden={hidden} delay={100 + i * 110}>
								<h2 className="mb-2 text-xs font-bold tracking-wider text-gray-500 uppercase">
									{column.title}
								</h2>
								<ul className="flex flex-col">
									{column.links.map((link) => (
										<li key={link.name}>
											<FooterNavLink
												link={link}
												onPoint={(target) =>
													pointAt(target ? link : null, target)
												}
												className="group relative -mx-3 flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-gray-400 transition-colors hover:text-white focus-visible:text-white"
											>
												<link.icon
													className="h-4 w-4 text-gray-600 transition-colors group-hover:text-amber-300 group-focus-visible:text-amber-300"
													aria-hidden
												/>
												<span>{link.name}</span>
												{link.external && (
													<>
														<ArrowUpRightIcon
															className="h-3.5 w-3.5 text-gray-600"
															aria-hidden
														/>
														<span className="sr-only">
															(opens in a new tab)
														</span>
													</>
												)}
											</FooterNavLink>
										</li>
									))}
								</ul>
							</Reveal>
						))}
					</nav>
				</div>

				<Reveal hidden={hidden} delay={380} className="self-start">
					<div
						className="motion-safe:footer-float"
						style={{ animationPlayState: onScreen ? "running" : "paused" }}
					>
						<InviteCard active={onScreen} />
					</div>
				</Reveal>
			</div>

			<div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-4 border-t border-white/[0.07] px-4 py-6 text-xs text-gray-500 sm:flex-row sm:px-6 lg:px-8">
				<span className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:w-auto sm:justify-start">
					<span className="whitespace-nowrap">
						© {new Date().getFullYear()} GoodWatch
					</span>
					<PoweredBy />
				</span>
				<CreatedBy />
			</div>

			<div
				aria-hidden
				className="pointer-events-none -mt-4 flex justify-center overflow-hidden opacity-[0.05] select-none"
			>
				<div className="translate-y-[30%]">
					<GoodWatchWordmark fontSize="clamp(64px, 16vw, 220px)" />
				</div>
			</div>
			{/* Room for the phone dock, which covers the bottom of the page below lg. */}
			<div className="h-24 lg:hidden" aria-hidden />
		</footer>
	)
}
