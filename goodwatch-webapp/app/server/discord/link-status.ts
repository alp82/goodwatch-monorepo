const messages: Record<string, string> = {
	state:
		"This Discord link has expired or could not be verified. Use the same browser and GoodWatch account to try again.",
	cancelled: "Discord sign-in was cancelled. You can try again.",
	missing_code: "Discord did not return a sign-in code. Please try again.",
	unavailable: "Linking isn't available yet. Please try again later.",
	failed: "Discord linking could not finish. Please try again.",
}
export function linkStatusMessage(status: string) {
	return Object.prototype.hasOwnProperty.call(messages, status)
		? messages[status]
		: messages.failed
}
