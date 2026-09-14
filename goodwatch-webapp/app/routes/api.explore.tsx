import { json } from "@remix-run/node"

export const loader = () => json({ error: "This endpoint has been retired. Use Discover.", results: [] }, { status: 410 })
