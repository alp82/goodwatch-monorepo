// Code that no page needs for its first render loads once the page is interactive: the sign-in client, and the
// dialogs behind the navigation. The rule is the one analytics load by (telemetry/load-trigger.ts): the first tap,
// key press or scroll, a hidden page, or a quiet page after the load event.
import { TELEMETRY_LOAD } from "~/telemetry/config"
import {
	browserLoadTriggerEnv,
	whenPageIsInteractive,
} from "~/telemetry/load-trigger"

/** Calls `run` once when the page is interactive. Call it from an effect. Returns a function that cancels it. */
export function whenInteractive(run: () => void): () => void {
	return whenPageIsInteractive(
		() => run(),
		browserLoadTriggerEnv(window),
		TELEMETRY_LOAD,
	)
}
