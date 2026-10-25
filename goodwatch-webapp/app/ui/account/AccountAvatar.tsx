// The member's picture in the account menu: their profile picture, else the handle's initial on their colour.
import type { AvatarColor } from "~/domain/profile"

export const AVATAR_GRADIENTS: Record<
	AvatarColor,
	{ from: string; to: string; ink: string }
> = {
	amber: { from: "#fbbf24", to: "#b45309", ink: "#451a03" },
	rose: { from: "#fb7185", to: "#be123c", ink: "#4c0519" },
	violet: { from: "#a78bfa", to: "#6d28d9", ink: "#2e1065" },
	sky: { from: "#38bdf8", to: "#0369a1", ink: "#082f49" },
	emerald: { from: "#34d399", to: "#047857", ink: "#022c22" },
	slate: { from: "#e2e8f0", to: "#64748b", ink: "#0f172a" },
}

export function AccountAvatar({
	url,
	color,
	initial,
	size,
	ring = false,
}: {
	url: string | null
	color: AvatarColor
	initial: string
	size: number
	ring?: boolean
}) {
	const ringClass = ring
		? "ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-950"
		: ""
	if (url)
		return (
			<img
				src={url}
				alt=""
				data-member-avatar
				className={`shrink-0 rounded-full object-cover object-top transition ${ringClass}`}
				style={{ width: size, height: size }}
			/>
		)
	const g = AVATAR_GRADIENTS[color] ?? AVATAR_GRADIENTS.amber
	return (
		<span
			aria-hidden
			className={`flex shrink-0 items-center justify-center rounded-full font-extrabold transition ${ringClass}`}
			style={{
				width: size,
				height: size,
				fontSize: size * 0.44,
				background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
				color: g.ink,
			}}
		>
			{initial}
		</span>
	)
}
