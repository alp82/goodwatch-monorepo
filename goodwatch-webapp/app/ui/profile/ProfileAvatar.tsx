import type { ProfileShell } from "~/domain/profile"

const AVATAR_GRADIENT: Record<string, [string, string, string]> = {
	amber: ["#fbbf24", "#b45309", "#451a03"],
	rose: ["#fb7185", "#be123c", "#4c0519"],
	violet: ["#a78bfa", "#6d28d9", "#2e1065"],
	sky: ["#38bdf8", "#0369a1", "#082f49"],
	emerald: ["#34d399", "#047857", "#022c22"],
	slate: ["#e2e8f0", "#64748b", "#0f172a"],
}

export function ProfileAvatar({
	handle,
	avatar,
	size = "lg",
}: {
	handle: string
	avatar: ProfileShell["avatar"]
	size?: "sm" | "md" | "lg"
}) {
	const box = {
		sm: "size-11 text-lg ring-2",
		md: "size-16 text-3xl ring-4",
		lg: "size-14 text-2xl ring-4 sm:size-20 sm:text-4xl",
	}[size]
	const cls = `${box} shrink-0 rounded-full ring-gray-950 shadow-xl`
	if (avatar.url)
		return (
			<img
				src={avatar.url}
				alt=""
				data-member-avatar
				className={`${cls} object-cover object-top`}
			/>
		)
	const [from, to, ink] = AVATAR_GRADIENT[avatar.color] ?? AVATAR_GRADIENT.amber
	return (
		<span
			aria-hidden
			className={`${cls} flex items-center justify-center font-extrabold`}
			style={{
				background: `linear-gradient(135deg, ${from}, ${to})`,
				color: ink,
			}}
		>
			{handle.charAt(0).toUpperCase()}
		</span>
	)
}
