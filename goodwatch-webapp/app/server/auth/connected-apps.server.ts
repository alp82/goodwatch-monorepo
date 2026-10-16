import type { ConsentApp } from "../../utils/mcp-connect.ts"
import { betterAuthEnabled, loadAuthRuntime } from "./boot.server.ts"
import { describeApp } from "./mcp-flow.server.ts"

// The apps that reach a member's GoodWatch through MCP (#570): one row per grant. Claude Code connects once per
// computer, with the same app, so each computer is a row of its own (#534, #566).

export type ConnectedApp = {
	/** The grant's id: what the member-owned `/api/auth/oauth2/delete-consent` takes. */
	id: string
	app: ConsentApp
	canChange: boolean
	connectedAt: string
	lastUsedAt: string | null
}

type Consent = {
	id: string
	clientId: string
	scopes?: string[] | string | null
	createdAt?: Date | string | null
	lastUsedAt?: Date | string | null
}
type Client = { name?: string; clientDiscoveryId?: string; disabled?: boolean; redirectUris?: string[] | string | null }

const list = (value: string[] | string | null | undefined): string[] =>
	Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,]+/).filter(Boolean) : []
const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : null)

/** The Connected apps page: not found while Better Auth is off, since apps connect through it only (#570). */
export async function connectedAppsPage(request: Request): Promise<ConnectedApp[] | null> {
	if (!betterAuthEnabled()) throw new Response("Not found", { status: 404 })
	return listConnectedApps(request)
}

/** The signed-in member's connected apps, newest use first. Null when Better Auth is off or nobody is signed in. */
export async function listConnectedApps(request: Request): Promise<ConnectedApp[] | null> {
	if (!betterAuthEnabled()) return null
	const { getBetterAuth } = await loadAuthRuntime()
	const auth = await getBetterAuth()
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session) return null
	const context = await auth.$context
	const consents = await context.adapter.findMany<Consent>({
		model: "oauthConsent",
		where: [{ field: "userId", value: session.user.id }],
	})
	const clients = new Map<string, Client | null>()
	for (const clientId of new Set(consents.map((consent) => consent.clientId)))
		clients.set(
			clientId,
			await context.adapter.findOne<Client>({ model: "oauthClient", where: [{ field: "clientId", value: clientId }] }),
		)
	return consents
		.flatMap((consent): ConnectedApp[] => {
			const client = clients.get(consent.clientId)
			// A disabled or removed app can't reach the member any more; the grant has nothing left to show.
			if (!client || client.disabled) return []
			return [
				{
					id: consent.id,
					app: describeApp({
						clientId: consent.clientId,
						name: client.name,
						verified: client.clientDiscoveryId === "cimd",
						redirectUri: list(client.redirectUris)[0],
					}),
					canChange: list(consent.scopes).includes("mcp:write"),
					connectedAt: iso(consent.createdAt) ?? new Date(0).toISOString(),
					lastUsedAt: iso(consent.lastUsedAt),
				},
			]
		})
		.sort((a, b) => (b.lastUsedAt ?? b.connectedAt).localeCompare(a.lastUsedAt ?? a.connectedAt))
}
