import { keyed } from "./crypto.server.ts"
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
/** 80-bit, reproducible opaque capability. The room ID remains separate. */
export function shortInvite(secret: string, roomId: string) {
	const bytes = Buffer.from(
		keyed(secret, "proposal-short-invite", roomId),
		"base64url"
	).subarray(0, 10)
	let bits = 0,
		value = 0,
		result = ""
	for (const byte of bytes) {
		value = (value << 8) | byte
		bits += 8
		while (bits >= 5) {
			bits -= 5
			result += alphabet[(value >>> bits) & 31]
		}
	}
	return result
}
export function normalizeShortInvite(input: string): string | null {
	const value = input.replace(/[\s-]/g, "").toUpperCase()
	return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(value) ? value : null
}
