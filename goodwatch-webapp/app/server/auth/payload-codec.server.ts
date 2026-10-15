import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

// The row envelope authenticates deletion and binds each ciphertext to its
// table, physical key and purpose. Receipts contain operation ids only.
export function authPayloadCodec(secret: string) {
	if (secret.length < 32) throw new Error("Auth payload encryption requires a secret of at least 32 characters")
	const key = createHash("sha256").update(`goodwatch-auth-payload-v1\0${secret}`).digest()
	return {
		encode(value: unknown, associatedData = ""): string {
			const nonce = randomBytes(12)
			const cipher = createCipheriv("aes-256-gcm", key, nonce)
			cipher.setAAD(Buffer.from(associatedData))
			const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
			return ["v2", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
		},
		decode(value: unknown, associatedData = ""): any {
			try {
				const [version, nonce, tag, ciphertext, extra] = String(value).split(".")
				if (version !== "v2" || !nonce || !tag || !ciphertext || extra !== undefined) throw new Error("Invalid payload envelope")
				const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"))
				decipher.setAAD(Buffer.from(associatedData))
				decipher.setAuthTag(Buffer.from(tag, "base64url"))
				const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()])
				return JSON.parse(plaintext.toString("utf8"))
			} catch {
				throw new Error("Could not decrypt and authenticate auth payload")
			}
		},
	}
}
