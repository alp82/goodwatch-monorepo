// PROTOTYPE - throwaway. #192: small pieces shared by the page mocks and the navigation variants, drawn after
// the settled prototypes' existing components (poster card, GoodWatch score, amber taste-match pill).
import { FingerPrintIcon, HomeIcon, MagnifyingGlassIcon, MapIcon, PlayIcon } from "@heroicons/react/24/solid"
import type { ComponentType, SVGProps } from "react"
import logoWhite from "~/img/goodwatch-logo-white.svg"
import type { NTitle } from "./data"
import { type PageKey, SERVICES, type Who, img, logo, matchOf, useShell } from "./model"

export const PAGE_ICON: Record<PageKey, ComponentType<SVGProps<SVGSVGElement>>> = {
	home: HomeIcon,
	watch: PlayIcon,
	discover: MagnifyingGlassIcon,
	taste: FingerPrintIcon,
	explorer: MapIcon,
}

export function Wordmark({ small }: { small?: boolean }) {
	const s = useShell()
	return (
		<button type="button" className={`rn-wordmark ${small ? "is-small" : ""}`} onClick={() => s.go("home")} aria-label="GoodWatch home">
			<img src={logoWhite} alt="" />
			{!small && <span>oodWatch</span>}
		</button>
	)
}

export function GMark({ size = 22 }: { size?: number }) {
	return <img src={logoWhite} alt="" className="rn-gmark" style={{ height: size, width: size }} />
}

export function Score({ v }: { v: number }) {
	return (
		<span className="rn-score" style={{ background: v >= 80 ? "#16a34a" : v >= 70 ? "#65a30d" : "#ca8a04" }}>
			<b>G</b>
			{v}
		</span>
	)
}

export function Match({ v }: { v: number }) {
	return (
		<span className="rn-match">
			<FingerPrintIcon />
			{v}
		</span>
	)
}

export function Poster({ t, rank, className = "" }: { t: NTitle; rank?: number; className?: string }) {
	return (
		<span className={`rn-poster ${className}`}>
			<img src={img(t.poster)} alt={t.title} loading="lazy" />
			{rank !== undefined && <span className="rn-rank">{rank}</span>}
		</span>
	)
}

export function Card({ t, guest }: { t: NTitle; guest?: boolean }) {
	return (
		<article className="rn-card">
			<img src={img(t.poster)} alt="" loading="lazy" />
			<span className="rn-card-badges">
				<Score v={t.score} />
				{!guest && <Match v={matchOf(t)} />}
			</span>
			<span className="rn-card-title">
				{t.title} ({t.year})
			</span>
		</article>
	)
}

export function Logos({ ids, size = 20 }: { ids: number[]; size?: number }) {
	return (
		<span className="rn-logos">
			{ids.map((id) => {
				const sv = SERVICES.find((x) => x.id === id)
				return sv ? <img key={id} src={logo(sv.logo)} alt={sv.name} style={{ width: size, height: size }} /> : null
			})}
		</span>
	)
}

/** The account slot: a sign-up call to action for guests, the avatar for members. */
export function Account({ who, compact }: { who: Who; compact?: boolean }) {
	const s = useShell()
	if (who === "guest")
		return (
			<button type="button" className={`rn-signup ${compact ? "is-compact" : ""}`} onClick={() => s.setSheet("signup")}>
				Sign up
			</button>
		)
	return (
		<button type="button" className="rn-avatar" aria-label="Your account">
			A
		</button>
	)
}

/** Tonight's pick as a tiny poster: the one-tap way to Watch next in several variants. */
export function TonightThumb({ label = true, className = "" }: { label?: boolean; className?: string }) {
	const s = useShell()
	const on = s.page === "watch"
	return (
		<button type="button" className={`rn-tonight ${on ? "is-on" : ""} ${className}`} onClick={() => s.go("watch")} aria-label={`Watch next: ${s.tonight.title}`}>
			<img src={img(s.tonight.poster, "w92")} alt="" />
			{label && (
				<span className="rn-tonight-text">
					<small>{s.who === "guest" ? "Wishlist" : "Tonight"}</small>
					<b>{s.tonight.title}</b>
				</span>
			)}
		</button>
	)
}
