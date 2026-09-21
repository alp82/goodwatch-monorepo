// THROWAWAY: isolated failure-path measurement, no production route.
import {json, type LoaderFunctionArgs} from "@remix-run/node"
import {runNativeVectorTranslationFallback} from "~/server/prototype-combined-d4.server"
export async function loader({request}: LoaderFunctionArgs) {
  if (process.env.NODE_ENV === "production") throw new Response("Not found", {status:404})
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0,500)
  if (!q) return json({})
  return json(await runNativeVectorTranslationFallback(q))
}
