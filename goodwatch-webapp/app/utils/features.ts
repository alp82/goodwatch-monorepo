export const REC_MODES = ["off", "shadow", "preview", "on"] as const
export type RecMode = (typeof REC_MODES)[number]

export function resolveRecPersonalOrder(
	mode: string | undefined,
	previewUsers: string | undefined,
	userId: string | null,
) {
	const resolved: RecMode = REC_MODES.includes(mode as RecMode)
		? (mode as RecMode)
		: "off"
	const preview = Boolean(
		userId &&
			(previewUsers ?? "")
				.split(",")
				.map((id) => id.trim())
				.includes(userId),
	)
	return {
		mode: resolved,
		enabled: Boolean(
			userId && (resolved === "on" || (resolved === "preview" && preview)),
		),
		shadow: Boolean(userId && resolved === "shadow" && preview),
	}
}
