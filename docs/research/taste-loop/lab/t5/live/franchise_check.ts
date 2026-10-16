// Prints production franchiseOf for each title read from stdin (JSON list); used by the parity test.
import { franchiseOf } from './prod/server/taste-portrait/sides.server'
const titles: string[] = JSON.parse(await Bun.stdin.text())
console.log(JSON.stringify(titles.map(franchiseOf)))
