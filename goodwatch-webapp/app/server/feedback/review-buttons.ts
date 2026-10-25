import type { Correction } from "./corrections.ts"
export function reviewButtons(c: Pick<Correction, "id" | "status">) {
	return {
		type: 1,
		components: [
			...(c.status === "pending"
				? [
						{ label: "Approve", action: "approve", style: 3 },
						{ label: "Reject", action: "reject", style: 4 },
					]
				: []),
			...(c.status === "live"
				? [
						{ label: "Approve", action: "approve", style: 3 },
						{ label: "Reject", action: "reject", style: 4 },
						{ label: "Revert", action: "revert", style: 2 },
					]
				: []),
		].map((b) => ({
			type: 2,
			label: b.label,
			style: b.style,
			custom_id: `feedback:${b.action}:${c.id}`,
			disabled: c.status === "live" && b.action === "approve",
		})),
	}
}
