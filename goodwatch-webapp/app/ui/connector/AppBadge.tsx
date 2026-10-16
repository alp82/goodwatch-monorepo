// Neutral marks for the apps a member can connect, not the apps' own logos (their makers' brand rules apply to those).
// The same marks as the consent prototype (#534).
export type AppKey = "claude" | "claude-code" | "chatgpt"

const LOOK: Record<AppKey, string> = {
	claude: "bg-[#d97757] text-white",
	"claude-code": "bg-[#2b2a27] text-[#d97757] ring-1 ring-[#d97757]/50",
	chatgpt: "bg-white text-black",
}

export function AppBadge({
	app,
	size = "md",
}: { app: AppKey; size?: "sm" | "md" }) {
	const dims =
		size === "sm"
			? "h-9 w-9 text-sm rounded-xl"
			: "h-12 w-12 text-lg rounded-2xl"
	return (
		<span
			aria-hidden="true"
			className={`inline-flex shrink-0 items-center justify-center ${dims} ${LOOK[app]}`}
		>
			{app === "claude" && <Spark />}
			{app === "claude-code" && (
				<span className="font-mono font-bold">&gt;_</span>
			)}
			{app === "chatgpt" && <span className="font-bold">G</span>}
		</span>
	)
}

function Spark() {
	return (
		<svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden="true">
			{[0, 30, 60, 90, 120, 150].map((angle) => (
				<rect
					key={angle}
					x="11"
					y="2"
					width="2"
					height="20"
					rx="1"
					fill="currentColor"
					transform={`rotate(${angle} 12 12)`}
				/>
			))}
		</svg>
	)
}
