// PROTOTYPE (start page lab, round 2): parts stage c and d share: the real poster card with a tap-to-love cover and a
// heart badge, a skeleton card for the loading moment, a fan of three mood posters, and the loading line.
import { HeartIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import type { LabCard } from "../../lab/types"

/** The amber heart in a dark ring that marks a loved title. */
export function HeartBadge({ on, className = "", size = "md" }: { on: boolean; className?: string; size?: "sm" | "md" }) {
	const box = size === "sm" ? "h-5 w-5" : "h-7 w-7"
	const icon = size === "sm" ? "h-3 w-3" : "h-4 w-4"
	return (
		<span
			aria-hidden
			className={`pointer-events-none flex items-center justify-center rounded-full bg-amber-400 text-gray-950 shadow-md shadow-black/50 ring-2 ring-gray-950 transition duration-200 ease-out ${box} ${on ? "scale-100 opacity-100" : "scale-50 opacity-0"} ${className}`}
		>
			<HeartIcon className={icon} />
		</span>
	)
}

/**
 * The site's poster card. While the guest is choosing (`onLove`), a cover over it makes a tap mark it loved: an amber
 * ring and a heart badge top left (the score pill stays top right). Without `onLove` it is the plain card, a link.
 */
export function LoveCard({
	card,
	loved,
	onLove,
	full,
	className = "",
	priority,
	onHover,
}: {
	card: LabCard
	loved: boolean
	onLove?: () => void
	/** Three are loved already: the others dim and don't take a tap. */
	full?: boolean
	className?: string
	priority?: boolean
	onHover?: (on: boolean) => void
}) {
	const off = !!onLove && full && !loved
	return (
		<div
			className={`relative ${className}`}
			onPointerEnter={(e) => e.pointerType === "mouse" && onHover?.(true)}
			onPointerLeave={(e) => e.pointerType === "mouse" && onHover?.(false)}
		>
			<div className={`transition-opacity duration-200 ${off ? "opacity-40" : ""} ${onLove ? "pointer-events-none" : ""}`}>
				<TitlePosterCard card={card} actions={false} posterPriority={priority ? "high" : undefined} />
			</div>
			{onLove ? (
				<button
					type="button"
					onClick={onLove}
					disabled={off}
					aria-pressed={loved}
					aria-label={`${card.title}: ${loved ? "loved" : "tap if you loved it"}`}
					className="absolute inset-0 z-10 cursor-pointer rounded-md outline-none transition-transform duration-150 [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.97] disabled:cursor-default"
				/>
			) : null}
			<span
				aria-hidden
				className={`pointer-events-none absolute -inset-[3px] z-10 rounded-[9px] border-[3px] border-amber-400 transition duration-200 ${loved && onLove ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
			/>
			<HeartBadge on={loved && !!onLove} className="absolute left-1 top-1 z-20" />
		</div>
	)
}

/** Holds a card's place while a typed search is on its way. Opacity only. */
export function SkeletonCard({ className = "", i = 0 }: { className?: string; i?: number }) {
	return (
		<div className={className}>
			<div
				className="aspect-[2/3] w-full animate-[cd-pulse_1.1s_ease-in-out_infinite] rounded-md bg-white/[0.07] ring-1 ring-white/[0.06]"
				style={{ animationDelay: `${(i % 8) * 70}ms` }}
			/>
		</div>
	)
}

export const CD_KEYFRAMES = `@keyframes cd-pulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cd-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes cd-fade{from{opacity:0}to{opacity:1}}`

/** Three posters of a mood, fanned. `spread` opens the fan (hover, chosen). Transform only. */
export function MoodFan({
	titles,
	hue,
	spread,
	className = "",
	poster = "w-[30px]",
}: {
	titles: LabCard[]
	hue: string
	spread: boolean
	className?: string
	/** The width class of one poster. */
	poster?: string
}) {
	// The first title in the middle, on top: draw the sides first.
	const items = [
		{ t: titles[1], r: spread ? -16 : -9, x: spread ? -62 : -42, y: spread ? 6 : 4 },
		{ t: titles[2], r: spread ? 14 : 8, x: spread ? 62 : 42, y: spread ? 6 : 4 },
		{ t: titles[0], r: 0, x: 0, y: spread ? -6 : 0 },
	]
	return (
		<span aria-hidden className={`pointer-events-none relative block ${className}`}>
			<span
				className="absolute inset-x-[10%] bottom-[-10%] top-[30%] rounded-full opacity-50 blur-xl transition-opacity duration-300"
				style={{ background: hue, opacity: spread ? 0.55 : 0.3 }}
			/>
			{items.map((p) => {
				const t = p.t
				if (!t) return null
				return (
					<span
						key={t.key}
						className={`absolute bottom-0 left-1/2 aspect-[2/3] overflow-hidden rounded-[3px] bg-gray-800 shadow-md shadow-black/60 ring-1 ring-black/40 transition-transform duration-300 ease-out ${poster}`}
						style={{ transform: `translateX(-50%) translateX(${p.x}%) translateY(${p.y}%) rotate(${p.r}deg)`, transformOrigin: "50% 100%" }}
					>
						<img src={tmdbImage(t.poster_path, "w185")} alt="" loading="lazy" className="h-full w-full object-cover" />
					</span>
				)
			})}
		</span>
	)
}

/** "Reading “…”" with a soft pulse, for the loading moment of a typed search. */
export function ReadingWait({ q, children }: { q: string; children?: ReactNode }) {
	return (
		<span className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-400">
			<span className="h-1.5 w-1.5 shrink-0 animate-[cd-pulse_0.9s_ease-in-out_infinite] rounded-full bg-amber-400" />
			<span className="truncate">
				Reading <span className="text-gray-200">“{q}”</span>
				{children}
			</span>
		</span>
	)
}
