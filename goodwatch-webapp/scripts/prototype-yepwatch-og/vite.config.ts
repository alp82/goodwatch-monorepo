// PROTOTYPE: only what the card renderer needs (the app config pulls in MDX and Remix).
import { fileURLToPath } from "node:url"
export default { resolve: { alias: { "~": fileURLToPath(new URL("../../app", import.meta.url)) } } }
