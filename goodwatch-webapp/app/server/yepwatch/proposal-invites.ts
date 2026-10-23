import { keyed } from "./crypto.server.ts"
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
/** 80-bit, reproducible opaque capability. The room ID remains separate. */
export function previousInvite(secret: string, roomId: string) {
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
	return /^(?:[2-9A-HJKMNP-Z]{6}|[0-9A-HJKMNP-TV-Z]{16})$/.test(value)
		? value
		: null
}

// O/0, I/1 and L are absent; uppercase letters and digits only.
const roomAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
export const INVITE_ATTEMPTS = 32
/** Reproducible candidates; the repository reserves each code atomically before publication. */
export function shortInvite(secret: string, roomId: string, attempt = 0) {
	const bytes = Buffer.from(
		keyed(secret, "proposal-six-invite", `${roomId}:${attempt}`),
		"base64url"
	)
	let value = bytes.readBigUInt64BE(0),
		result = ""
	for (let i = 0; i < 6; i++) {
		result += roomAlphabet[Number(value % BigInt(roomAlphabet.length))]
		value /= BigInt(roomAlphabet.length)
	}
	return result
}
