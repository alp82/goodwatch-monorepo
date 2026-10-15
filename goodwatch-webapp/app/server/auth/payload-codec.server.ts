import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createHmac,
	randomBytes,
} from "node:crypto"

export class AuthPayloadAuthenticationError extends Error {
 readonly table: string
 readonly id: string
 constructor(aad: string) {
  super("Could not decrypt and authenticate auth payload")
  const boundary = aad.indexOf(":")
  this.table = aad.slice(0,boundary)
  this.id = aad.slice(boundary+1,aad.lastIndexOf(":"))
 }
}

export function authCredentialVersion(secret: string, password: string | null) {
	return createHmac("sha256", secret)
		.update(JSON.stringify(["session-credential", password]))
		.digest("hex")
}

export type AuthEncryptionKeys = {
	active: string
	keys: Record<string, string>
	allowLegacy?: boolean
}

function validateKeys(ring: AuthEncryptionKeys) {
	if (
		!ring ||
		typeof ring !== "object" ||
		typeof ring.active !== "string" ||
		!ring.keys ||
		Array.isArray(ring.keys) ||
		!Object.prototype.hasOwnProperty.call(ring.keys, ring.active) ||
		Object.keys(ring.keys).length > 16 ||
		(ring.allowLegacy !== undefined && typeof ring.allowLegacy !== "boolean")
	)
		throw new Error("Invalid auth encryption key ring")
	for (const [id, secret] of Object.entries(ring.keys))
		if (
			!/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
			typeof secret !== "string" ||
			secret.length < 32
		)
			throw new Error("Invalid auth encryption key ring")
}
export function parseAuthEncryptionKeys(json: string): AuthEncryptionKeys {
	let ring: AuthEncryptionKeys
	try {
		ring = JSON.parse(json)
		validateKeys(ring)
	} catch {
		throw new Error("Invalid auth encryption key ring")
	}
	return ring
}

// The permanent secret still derives legacy encryption and keyed lookup indexes.
// Independent versioned payload keys rotate without moving email/verification keys.
export function authPayloadCodec(secret: string, ring?: AuthEncryptionKeys) {
	if (secret.length < 32)
		throw new Error(
			"Auth payload encryption requires a secret of at least 32 characters",
		)
	if (ring) validateKeys(ring)
	const derive = (material: string) =>
		createHash("sha256")
			.update(`goodwatch-auth-payload-v1\0${material}`)
			.digest()
	const legacyKey = derive(secret)
	return {
		usesActiveKey(value: unknown): boolean {
			const parts = String(value).split(".")
			return ring
				? parts[0] === "v3" && parts[1] === ring.active
				: parts[0] === "v2"
		},
		encode(value: unknown, associatedData = ""): string {
			const nonce = randomBytes(12)
			const cipher = createCipheriv(
				"aes-256-gcm",
				ring ? derive(ring.keys[ring.active]) : legacyKey,
				nonce,
			)
			cipher.setAAD(
				Buffer.from(
					ring ? `v3:${ring.active}:${associatedData}` : associatedData,
				),
			)
			const ciphertext = Buffer.concat([
				cipher.update(JSON.stringify(value), "utf8"),
				cipher.final(),
			])
			return [
				...(ring ? ["v3", ring.active] : ["v2"]),
				nonce.toString("base64url"),
				cipher.getAuthTag().toString("base64url"),
				ciphertext.toString("base64url"),
			].join(".")
		},
		// biome-ignore lint/suspicious/noExplicitAny: Authenticated JSON is validated against each model by the adapter.
		decode(value: unknown, associatedData = ""): any {
			try {
				const parts = String(value).split(".")
				const version = parts.shift()
				let key = legacyKey
				let aad = associatedData
				if (version === "v3") {
					const id = parts.shift()
					if (
						!id ||
						!ring ||
						!Object.prototype.hasOwnProperty.call(ring.keys, id)
					)
						throw new Error("Unknown auth payload key")
					key = derive(ring.keys[id])
					aad = `v3:${id}:${associatedData}`
				} else if (version !== "v2" || ring?.allowLegacy === false)
					throw new Error("Invalid payload envelope")
				const [nonce, tag, ciphertext, extra] = parts
				if (!nonce || !tag || !ciphertext || extra !== undefined)
					throw new Error("Invalid payload envelope")
				const decipher = createDecipheriv(
					"aes-256-gcm",
					key,
					Buffer.from(nonce, "base64url"),
				)
				decipher.setAAD(Buffer.from(aad))
				decipher.setAuthTag(Buffer.from(tag, "base64url"))
				const plaintext = Buffer.concat([
					decipher.update(Buffer.from(ciphertext, "base64url")),
					decipher.final(),
				])
				return JSON.parse(plaintext.toString("utf8"))
			} catch {
				throw new AuthPayloadAuthenticationError(associatedData)
			}
		},
	}
}
