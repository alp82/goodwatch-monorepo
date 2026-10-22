import {
	routeInteraction,
	type Dependencies,
	type Interaction,
} from "./router.server.ts"
import { verifySignature } from "./verify.server.ts"
export async function handleInteraction(
	request: Request,
	options: { publicKey?: string; dependencies?: Partial<Dependencies> } = {},
) {
	if (request.method !== "POST")
		return new Response(null, { status: 405, headers: { Allow: "POST" } })
	const key = options.publicKey ?? process.env.DISCORD_PUBLIC_KEY
	if (!key) return new Response(null, { status: 503 })
	const body = await request.text()
	if (
		!verifySignature(
			key,
			request.headers.get("X-Signature-Ed25519"),
			request.headers.get("X-Signature-Timestamp"),
			body,
		)
	)
		return new Response(null, { status: 401 })
	let interaction: Interaction
	try {
		interaction = JSON.parse(body)
		if (
			!interaction ||
			typeof interaction !== "object" ||
			!Number.isInteger(interaction.type)
		)
			throw new Error("Invalid interaction")
	} catch {
		return new Response(null, { status: 400 })
	}
	return new Response(
		JSON.stringify(await routeInteraction(interaction, options.dependencies)),
		{
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store",
			},
		},
	)
}
