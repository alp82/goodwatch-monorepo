import { json } from "@remix-run/node"
import { authMaintenanceOn } from "~/server/auth/cutover-notice.server"

// Whether the cut-over notice is on now. A page that a cache served from before the flag flipped asks this before it
// calls Supabase from the browser, which no server can refuse. Never cached.
export const loader = () => json({ maintenance: authMaintenanceOn() }, { headers: { "Cache-Control": "private, no-store" } })
