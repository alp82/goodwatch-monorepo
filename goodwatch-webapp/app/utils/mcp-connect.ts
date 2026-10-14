// What the sign-in and consent pages know about an app connecting through MCP (#570). Shared by the server
// (server/auth/mcp-flow.server.ts) and the pages.

/** How the page shows the app. Verified means it published its details (CIMD); one that registered itself (DCR) is not. */
export type ConsentApp = {
	name: string
	/** Where its details live (CIMD), or where it returns to. "this computer" for a loopback callback. */
	host: string
	verified: boolean
	kind: "claude" | "claude-code" | "chatgpt" | null
}
export type ConsentView = {
	app: ConsentApp
	email: string
	canChange: boolean
	/** Signs the member out and starts the app's request again, for "Not you?". */
	restartUrl: string
}

/** An app waiting for a sign-in: who it is, the signed query that goes back with the sign-in, and where a member who is
 * signed in already continues (the app's request again, which leads to the consent page). */
export type ConnectState = { app: ConsentApp; oauthQuery: string; continueUrl: string }
