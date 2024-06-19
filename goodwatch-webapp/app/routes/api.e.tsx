import { ActionFunction, ActionFunctionArgs, json } from '@remix-run/node'

const SENTRY_HOST = "o4507456417169408.ingest.de.sentry.io"
const SENTRY_PROJECT_IDS = ["4507456420184144"]


export const action: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  try {
    const envelope = await request.text()
    const piece = envelope.split("\n")[0]
    const header = JSON.parse(piece)
    const dsn = new URL(header["dsn"])
    const project_id = dsn.pathname?.replace("/", "")

    if (dsn.hostname !== SENTRY_HOST) {
      throw new Error(`Invalid sentry hostname: ${dsn.hostname}`)
    }

    if (!project_id || !SENTRY_PROJECT_IDS.includes(project_id)) {
      throw new Error(`Invalid sentry project id: ${project_id}`)
    }

    const upstream_sentry_url = `https://${SENTRY_HOST}/api/${project_id}/envelope/`
    await fetch(upstream_sentry_url, { method: "POST", body: envelope })

    return json({}, { status: 200 })
  } catch (e) {
    console.error("error tunneling to sentry", e)
    return json({ error: "error tunneling to sentry" }, { status: 500 })
  }
}
