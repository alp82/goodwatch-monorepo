import { Resolver } from "node:dns/promises"
import { isIP } from "node:net"

export type SearchBot = "google" | "bing" | "unverified" | "unknown"
export function canonicalAddress(address: string): string | null {
	if (!isIP(address) || address.includes("%")) return null
	if (isIP(address) === 4) return address
	const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1)
	const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(normalized)
	if (!mapped) return normalized
	const high = parseInt(mapped[1], 16),
		low = parseInt(mapped[2], 16)
	return [high >> 8, high & 255, low >> 8, low & 255].join(".")
}
type Dns = {
	reverse(address: string): Promise<string[]>
	resolve4(name: string): Promise<string[]>
	resolve6(name: string): Promise<string[]>
	cancel(): void
}
const absent = (error: unknown) =>
	["ENOTFOUND", "ENODATA"].includes((error as { code?: string })?.code ?? "")

/** Forward-confirmed reverse DNS, bounded and coalesced by address. The UA never grants an exemption. */
export function createSearchBotVerifier(
	options: {
		resolver?: () => Dns
		now?: () => number
		timeoutMs?: number
		maxPending?: number
		positiveMs?: number
		negativeMs?: number
		maxEntries?: number
	} = {},
) {
	const now = options.now ?? Date.now
	const cache = new Map<string, { result: SearchBot; expires: number }>()
	const pending = new Map<string, Promise<SearchBot>>()
	return function verify(raw: string): Promise<SearchBot> {
		const address = canonicalAddress(raw)
		if (!address) return Promise.resolve("unverified")
		const cached = cache.get(address)
		if (cached && cached.expires > now()) return Promise.resolve(cached.result)
		const flight = pending.get(address)
		if (flight) return flight
		if (pending.size >= (options.maxPending ?? 32))
			return Promise.resolve("unknown")
		const dns = options.resolver?.() ?? new Resolver({ timeout: 700, tries: 1 })
		let timer: ReturnType<typeof setTimeout>
		const work = async (): Promise<SearchBot> => {
			try {
				const names = await dns.reverse(address)
				for (const rawName of names.slice(0, 8)) {
					const name = rawName.toLowerCase().replace(/\.$/, "")
					const bot = name.endsWith(".googlebot.com")
						? "google"
						: name.endsWith(".search.msn.com")
							? "bing"
							: null
					if (!bot) continue
					const answers = await Promise.allSettled([
						dns.resolve4(name),
						dns.resolve6(name),
					])
					if (
						answers.some(
							(a) =>
								a.status === "fulfilled" &&
								a.value.some((ip) => canonicalAddress(ip) === address),
						)
					)
						return bot
					if (answers.some((a) => a.status === "rejected" && !absent(a.reason)))
						return "unknown"
				}
				return "unverified"
			} catch (error) {
				return absent(error) ? "unverified" : "unknown"
			}
		}
		const timeout = new Promise<SearchBot>((resolve) => {
			timer = setTimeout(() => {
				dns.cancel()
				resolve("unknown")
			}, options.timeoutMs ?? 1500)
		})
		const result = Promise.race([work(), timeout])
			.then((result) => {
				cache.delete(address)
				cache.set(address, {
					result,
					expires:
						now() +
						(result === "unknown"
							? 5000
							: result === "unverified"
								? (options.negativeMs ?? 300_000)
								: (options.positiveMs ?? 86_400_000)),
				})
				while (cache.size > (options.maxEntries ?? 10_000))
					cache.delete(cache.keys().next().value!)
				return result
			})
			.finally(() => {
				clearTimeout(timer)
				pending.delete(address)
			})
		pending.set(address, result)
		return result
	}
}
export const verifySearchBot = createSearchBotVerifier()
