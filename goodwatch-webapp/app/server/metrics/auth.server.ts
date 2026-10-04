import { authCheckCounts } from "../../utils/auth-session.ts"
import { gauge } from "./registry.server.ts"

export function startAuthMetrics(): void {
	gauge(
		"goodwatch_auth_checks_total",
		"Authentication checks by resolution source.",
		["source"],
		() =>
			(["none", "memo", "local", "server", "error"] as const).map((source) => ({
				labels: [source],
				value: authCheckCounts[source],
			})),
		5,
	)
}
