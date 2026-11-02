// One assertion contract for the visible lab and the command-line audit.
const normalize = (value) =>
	String(value ?? "")
		.split(",")
		.sort()
		.join(",")
const messages = (value) =>
	Array.isArray(value) ? value : value ? [value] : []

export function evaluateCase(fixture, data) {
	const failures = []
	if (data.error || !data.filters || typeof data.residual !== "string")
		return {
			status: "Error",
			failures: [data.error ?? "Invalid interpretation response"],
		}
	for (const [key, expected] of Object.entries(fixture.expect ?? {}))
		if (normalize(data.filters[key]) !== normalize(expected))
			failures.push(
				`${key}: expected ${expected}, got ${data.filters[key] ?? "absent"}`,
			)
	for (const key of fixture.absent ?? [])
		if (key in data.filters) failures.push(`${key} should be absent`)
	if (
		fixture.residualContains &&
		!data.residual
			.toLowerCase()
			.includes(fixture.residualContains.toLowerCase())
	)
		failures.push(
			`Remaining text should include ${JSON.stringify(fixture.residualContains)}`,
		)
	if ("residualEquals" in fixture && data.residual !== fixture.residualEquals)
		failures.push(
			`Remaining text: expected ${JSON.stringify(fixture.residualEquals)}, got ${JSON.stringify(data.residual)}`,
		)
	for (const text of messages(fixture.noWarningContains))
		if (data.warnings.some((warning) => warning.includes(text)))
			failures.push(`Unexpected warning: ${text}`)
	for (const text of messages(fixture.warningContains))
		if (!data.warnings.some((warning) => warning.includes(text)))
			failures.push(`Missing warning: ${text}`)
	if (fixture.exact) {
		const allowed = new Set([
			"services",
			"unseen",
			...Object.keys(fixture.expect ?? {}),
		])
		for (const key of Object.keys(data.filters))
			if (!allowed.has(key))
				failures.push(`Unexpected filter ${key}=${data.filters[key]}`)
	}
	const asserted =
		fixture.expect ||
		fixture.absent ||
		fixture.residualContains ||
		"residualEquals" in fixture ||
		fixture.noWarningContains ||
		fixture.warningContains
	return {
		status: failures.length
			? "Mismatch"
			: asserted
				? "Matches expectations"
				: "Review probe",
		failures,
	}
}
