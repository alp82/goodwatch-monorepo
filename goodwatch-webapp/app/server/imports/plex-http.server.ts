import { lookup } from "node:dns/promises"
import { request } from "node:https"
import { BlockList, isIP } from "node:net"
import { networkInterfaces } from "node:os"

export class PlexError extends Error {
	status: number
	constructor(
		message = "Plex could not be read. Please try again.",
		status = 502,
	) {
		super(message)
		this.status = status
	}
}
const blocked = new BlockList()
for (const [address, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["192.88.99.0", 24],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 3],
] as const)
	blocked.addSubnet(address, prefix, "ipv4")
const publicV6 = new BlockList()
publicV6.addSubnet("2000::", 3, "ipv6")
blocked.addSubnet("2001::", 23, "ipv6")
blocked.addSubnet("2001:db8::", 32, "ipv6")
blocked.addSubnet("2002::", 16, "ipv6")
blocked.addSubnet("3fff::", 20, "ipv6")
for (const entries of Object.values(networkInterfaces()))
	for (const entry of entries ?? [])
		blocked.addAddress(entry.address, entry.family === "IPv6" ? "ipv6" : "ipv4")
const unsafe = () =>
	new PlexError(
		"GoodWatch can only reach public HTTPS Plex servers. Private or internal network addresses are not allowed.",
		400,
	)
const allowed = (address: string) => {
	const family = isIP(address)
	return family === 4
		? !blocked.check(address, "ipv4")
		: family === 6 &&
				publicV6.check(address, "ipv6") &&
				!blocked.check(address, "ipv6")
}
export interface PlexReply {
	text: string
	headers: Record<string, string | string[] | undefined>
}
export type PlexHttp = (
	url: string,
	options?: { method?: "GET" | "POST"; headers?: Record<string, string> },
) => Promise<PlexReply>

/** No global fetch, proxy, redirect or second DNS lookup can bypass this boundary. */
export function createPlexHttp(
	options: {
		resolve?: (
			hostname: string,
		) => Promise<{ address: string; family: number }[]>
	} = {},
): PlexHttp {
	const resolve =
		options.resolve ?? ((hostname) => lookup(hostname, { all: true }))
	return async (input, options = {}) => {
		let url: URL
		try {
			url = new URL(input)
		} catch {
			throw unsafe()
		}
		if (url.protocol !== "https:" || url.username || url.password || url.hash)
			throw unsafe()
		const hostname = url.hostname.replace(/^\[|\]$/g, "")
		let addresses: { address: string; family: number }[]
		let dnsTimer: ReturnType<typeof setTimeout> | undefined
		try {
			addresses = isIP(hostname)
				? [{ address: hostname, family: isIP(hostname) }]
				: await Promise.race([
						resolve(hostname),
						new Promise<never>((_, reject) => {
							dnsTimer = setTimeout(() => reject(new PlexError()), 10_000)
							dnsTimer.unref()
						}),
					])
		} catch {
			throw new PlexError()
		} finally {
			clearTimeout(dnsTimer)
		}
		if (!addresses.length || addresses.some(({ address }) => !allowed(address)))
			throw unsafe()
		const pinned = addresses[0]
		return new Promise((resolve, reject) => {
			const req = request(
				url,
				{
					method: options.method ?? "GET",
					headers: options.headers,
					agent: false,
					// Pin the validated address while retaining the original Host and TLS certificate checks.
					lookup: (_host, opts, callback) => {
						if (opts.all) callback(null, [pinned])
						else callback(null, pinned.address, pinned.family)
					},
					signal: AbortSignal.timeout(10_000),
				},
				(response) => {
					if (response.statusCode !== 200 && response.statusCode !== 201) {
						response.destroy()
						reject(
							new PlexError(undefined, response.statusCode === 404 ? 404 : 502),
						)
						return
					}
					const chunks: Buffer[] = []
					let size = 0
					response.on("data", (chunk: Buffer) => {
						size += chunk.length
						if (size > 5 * 1024 * 1024) {
							response.destroy()
							reject(
								new PlexError("Plex returned too much data for one request."),
							)
						} else chunks.push(chunk)
					})
					response.on("end", () =>
						resolve({
							text: Buffer.concat(chunks).toString("utf8"),
							headers: response.headers,
						}),
					)
					response.on("error", () => reject(new PlexError()))
				},
			)
			req.on("error", () => reject(new PlexError()))
			req.end()
		})
	}
}
