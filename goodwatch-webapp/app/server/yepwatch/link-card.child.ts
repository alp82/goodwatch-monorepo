// Child process entry: draws the room invite card for the host name in argv[2] (JSON) and writes the PNG to stdout.
// The api spawns it per card, so a slow or aborting render never touches the api process.
import { inviteCard, renderCard } from "./link-cards.ts"

const host = JSON.parse(process.argv[2] ?? "null") as string | null
process.stdout.write(await renderCard(inviteCard(host)))
