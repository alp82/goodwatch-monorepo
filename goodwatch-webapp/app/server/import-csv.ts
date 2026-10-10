/** Spreadsheet-safe CSV: imported source text cannot become a formula when the download is opened. */
export function csvLine(cells: (string | number | null)[]): string {
	return cells
		.map((cell) => {
			let value = cell === null ? "" : String(cell)
			if (/^[=+\-@\t\r]/.test(value) && typeof cell === "string")
				value = `'${value}`
			return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
		})
		.join(",")
}
