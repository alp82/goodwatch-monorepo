import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

// Rows and receipts both contain recoverable credentials. The lookup columns
// carry identifiers only; the complete document is authenticated ciphertext.
export function authPayloadCodec(secret: string) {
	if (secret.length < 32) throw new Error("Auth payload encryption requires a secret of at least 32 characters")
	const key = createHash("sha256").update(`goodwatch-auth-payload-v1\0${secret}`).digest()
	return {
		encode(value: unknown): string {
			const nonce = randomBytes(12)
			const cipher = createCipheriv("aes-256-gcm", key, nonce)
			const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
			return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
		},
		decode(value: unknown): any {
			try {
				const [version, nonce, tag, ciphertext, extra] = String(value).split(".")
				if (version !== "v1" || !nonce || !tag || !ciphertext || extra !== undefined) throw new Error("Invalid payload envelope")
				const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"))
				decipher.setAuthTag(Buffer.from(tag, "base64url"))
				const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()])
				return JSON.parse(plaintext.toString("utf8"))
			} catch {
				throw new Error("Could not decrypt and authenticate auth payload")
			}
		},
	}
}
