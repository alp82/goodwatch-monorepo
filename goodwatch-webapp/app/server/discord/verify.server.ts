import { createPublicKey, verify } from "node:crypto"

export function verifySignature(
	publicKey: string,
	signature: string | null,
	timestamp: string | null,
	body: string,
	now: () => number = Date.now,
): boolean {
	if (
		!/^[a-f\d]{64}$/i.test(publicKey) ||
		!signature ||
		!/^[a-f\d]{128}$/i.test(signature) ||
		!timestamp ||
		!/^\d+$/.test(timestamp)
	)
		return false
	const age = now() - Number(timestamp) * 1000
	if (!Number.isFinite(age) || age > 5 * 60_000 || age < -60_000) return false
	try {
		const key = createPublicKey({
			key: Buffer.concat([
				Buffer.from("302a300506032b6570032100", "hex"),
				Buffer.from(publicKey, "hex"),
			]),
			format: "der",
			type: "spki",
		})
		return verify(
			null,
			Buffer.from(timestamp + body),
			key,
			Buffer.from(signature, "hex"),
		)
	} catch {
		return false
	}
}
