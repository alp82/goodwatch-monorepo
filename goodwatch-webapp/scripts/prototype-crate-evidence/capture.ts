// PROTOTYPE: replay existing question design unchanged, two calls per request.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { interpretEvidencePrototype } from "../../app/server/prototype-jev-vector.server"

const requests = [
	"car chases", "sunglasses", "unreliable narrator", "dark comedy about rich people",
	"tense but not bleak", "no anime, gritty crime show", "with my parents",
	"I want something tense that keeps me guessing, but I don’t want to finish it feeling miserable.",
	"Rich people being absolutely awful to each other, preferably funny.",
	"A crime show that feels grubby and real. No animation, and nothing where the detective has magic powers.",
	"Something where halfway through you realise the person telling the story has been feeding you nonsense.",
	"Give me car chases, but make it more getaway driver than superheroes destroying a city.",
	"Brain’s fried. Something warm and funny, but not painfully cheesy.",
]
const output = process.argv[2]
if (!output) throw new Error("Pass output JSON path")
const results = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : []
for (const request of requests) {
	if (results.some((r: { request: string }) => r.request === request)) continue
	results.push(await interpretEvidencePrototype(request))
	writeFileSync(output, JSON.stringify(results, null, 2))
	console.log(`Captured ${results.length}/${requests.length}: ${request}`)
}
