import type { McpServer } from "@modelcontextprotocol/server"
import { instrument, type MCPAnalyticsOptions } from "@posthog/mcp"
import { PostHog } from "posthog-node"
import { INTERNAL_USER_IDS } from "../../telemetry/product-events.ts"
import { onShutdown } from "../lifecycle.server.ts"

let client: PostHog | undefined
function analyticsClient(): PostHog | undefined {
	if (
		process.env.NODE_ENV !== "production" ||
		process.env.POSTHOG_DISABLED === "true" ||
		!process.env.POSTHOG_API_KEY
	)
		return
	if (!client) {
		client = new PostHog(process.env.POSTHOG_API_KEY, {
			host: process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
			enableExceptionAutocapture: false,
		})
		onShutdown("MCP analytics", () => client?.shutdown())
	}
	return client
}

export function mcpAnalyticsOptions(userId: string): MCPAnalyticsOptions {
	return {
		// The endpoint verified this identity before constructing the server.
		identify: () => ({ distinctId: userId }),
		eventProperties: () => ({
			source: "mcp",
			user_id: userId,
			$user_id: userId,
			is_guest: false,
			is_internal: INTERNAL_USER_IDS.has(userId),
		}),
		// Keep intent and operational metadata, without copying a member's library,
		// tool arguments, or returned personal data into analytics.
		beforeSend: (event) => {
			delete event.properties.$mcp_parameters
			delete event.properties.$mcp_response
			return event
		},
	}
}

/** One shared delivery queue; each stateless server gets its own instrumentation. */
export function instrumentMcpServer(server: McpServer, userId: string): void {
	const posthog = analyticsClient()
	if (posthog) instrument(server, posthog, mcpAnalyticsOptions(userId))
}
