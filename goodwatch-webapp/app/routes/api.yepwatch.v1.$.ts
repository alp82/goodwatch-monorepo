import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { yepWatchHandler } from '../server/yepwatch/runtime.server'
export const loader = ({ request }: LoaderFunctionArgs) => yepWatchHandler(request)
export const action = ({ request }: ActionFunctionArgs) => yepWatchHandler(request)
