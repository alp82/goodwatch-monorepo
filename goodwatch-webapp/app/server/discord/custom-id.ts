export type CardAction = "watch" | "share"
export const isTitleId = (value: string) =>
	/^(movie|show):[1-9]\d{0,9}$/.test(value)
export function formatCustomId(action: CardAction, titleId: string): string {
	const value = `gw1:${action}:${titleId}`
	if (
		!["watch", "share"].includes(action) ||
		!isTitleId(titleId) ||
		value.length > 100
	)
		throw new Error("Invalid custom ID")
	return value
}
export function parseCustomId(
	value: string,
): { action: CardAction; titleId: string } | null {
	if (value.length > 100) return null
	const match = /^gw1:(watch|share):((?:movie|show):[1-9]\d{0,9})$/.exec(value)
	return match ? { action: match[1] as CardAction, titleId: match[2] } : null
}
