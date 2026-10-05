// PROTOTYPE - throwaway. The round-6 title card (#180): what comes forward when you're close to a poster, over the
// live map. It reuses the site's pieces as they are (the GoodWatch score ring, the streaming logos, the Want to See and
// Seen it buttons) inside a glass card with the title's backdrop, why it fits you, and a step toward each
// neighboring island showing the exact title it lands on. A caption is the small form: title and match only.
import { MapPinIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { forwardRef } from "react"
import { HEAT } from "~/ui/prototype-rec-explorer-2/Stage"
import { asPool } from "~/ui/prototype-rec-explorer-3/kit3"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { PeekInfo4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { ActionButton } from "~/ui/prototype-rec-explorer/kit"
import { Ring, ServiceLogos, href } from "~/ui/prototype-rec-taste/kit"
import { TMDB } from "./surface6"
import type { W } from "./wire6"

export type DoorCard = { id: string; name: string; color: string; item: W | null }

type Props = {
	ex: Ex4
	it: W
	where: { name: string; color: string }
	info: PeekInfo4 | null
	doors: DoorCard[] | null
	pinned: boolean
	onPin: () => void
	onClose: () => void
	onDoor: (d: DoorCard) => void
	/** "float" beside the poster, "sheet" docked at the bottom, "drawer" in the side drawer. */
	form: "float" | "sheet" | "drawer"
	/** Peek: only the top of the card until it's pinned. */
	peek?: boolean
	className?: string
}

export const Card6 = forwardRef<HTMLDivElement, Props>(function Card6(
	{ ex, it, where, info, doors, pinned, onPin, onClose, onDoor, form, peek = false, className = "" },
	ref,
) {
	const pi = asPool(it)
	const kind = pi.type === "show" ? "Series" : "Film"
	const meta = [it.yr ? String(it.yr) : "", kind, it.g.slice(0, 2).join(" and ").toLowerCase()].filter(Boolean).join(", ")
	const people = info?.people.length ? `${info.role} ${info.people.join(" and ")}` : ""
	const openDoors = (doors ?? []).filter((d) => d.item)
	return (
		<div
			ref={ref}
			className={`rx6-card rx6-card-${form} ${peek ? "rx6-card-peek" : ""} ${pinned ? "rx6-card-pinned" : ""} ${className}`}
			style={{ "--isl": where.color } as React.CSSProperties}
			aria-live="polite"
			// A peek opens into the full card when you tap it anywhere.
			onClick={peek ? onPin : undefined}
			onKeyDown={peek ? (e) => e.key === "Enter" && onPin() : undefined}
		>
			<div className="rx6-card-hero">
				{it.b ? <img crossOrigin="anonymous" src={`${TMDB}/w780${it.b}`} alt="" className="rx6-card-bd" /> : null}
				<div className="rx6-card-veil" />
				<div className="rx6-card-head">
					<span className="rx6-card-where">
						<span className="rx6-dot" style={{ background: where.color }} />
						{where.name}
					</span>
					<h2 className="rx6-card-t">{it.t}</h2>
					<p className="rx6-card-meta">{meta}</p>
				</div>
				<div className="rx6-card-tools">
					{pinned ? (
						<button type="button" className="rx6-icon" onClick={onClose} aria-label="Close">
							<XMarkIcon className="rx6-i" />
						</button>
					) : (
						<button type="button" className="rx6-icon" onClick={onPin} aria-label="Keep this card open">
							<MapPinIcon className="rx6-i" />
						</button>
					)}
				</div>
			</div>
			<div className="rx6-card-body">
				<div className="rx6-card-row">
					<Ring item={pi} size={40} />
					{it.r ? (
						<span className="rx6-match">
							You rated it <b>{it.r}</b>
						</span>
					) : (
						<span className="rx6-match">
							<b style={{ color: HEAT[it.m] ?? "#fbbf24" }}>{it.m}%</b> your taste
						</span>
					)}
					<span className="rx6-card-svc">
						<ServiceLogos item={pi} services={ex.services} size="w-6 h-6" />
					</span>
				</div>
				{!peek && (
					<>
						{(info?.why || people) && (
							<p className="rx6-why">
								{info?.why}
								{info?.why && people ? " " : ""}
								{people && <span className="rx6-people">{people}.</span>}
							</p>
						)}
						{!info && <p className="rx6-why rx6-why-wait">Looking at why it fits you…</p>}
						<div className="rx6-acts">
							<ActionButton kind="want" active={!!(it.f & 4)} onClick={() => ex.actions.want(it)} />
							<ActionButton kind="seen" active={!!(it.f & 2)} onClick={() => ex.actions.seen(it)} />
						</div>
						{openDoors.length > 0 && (
							<div className="rx6-doors">
								<p className="rx6-doors-h">Step toward a neighboring island</p>
								<div className="rx6-doors-list">
									{openDoors.map((d) => (
										<button key={d.id} type="button" className="rx6-door" onClick={() => onDoor(d)} style={{ "--door": d.color } as React.CSSProperties}>
											{d.item?.p ? <img crossOrigin="anonymous" src={`${TMDB}/w92${d.item.p}`} alt="" className="rx6-door-img" /> : <span className="rx6-door-img" />}
											<span className="rx6-door-txt">
												<span className="rx6-door-to">{d.name}</span>
												<span className="rx6-door-t">{d.item?.t}</span>
											</span>
										</button>
									))}
								</div>
							</div>
						)}
						{doors == null && <div className="rx6-doors rx6-doors-wait" aria-hidden />}
						<Link to={href(pi)} className="rx6-open">
							Open the title page
						</Link>
					</>
				)}
				{peek && <p className="rx6-peek-hint">{form === "sheet" ? "Tap for why it fits you, and where to go next" : "Click to keep it open"}</p>}
			</div>
		</div>
	)
})

/** The small form: title and match, under a poster. */
export const Caption6 = forwardRef<HTMLDivElement, { it: W; onClick: () => void }>(function Caption6({ it, onClick }, ref) {
	return (
		<div ref={ref} className="rx6-cap">
			<button type="button" onClick={onClick} className="rx6-cap-b">
				<span className="rx6-cap-t">{it.t}</span>
				<span className="rx6-cap-m" style={{ color: HEAT[it.m] ?? "#fbbf24" }}>
					{it.m}%
				</span>
			</button>
		</div>
	)
})
