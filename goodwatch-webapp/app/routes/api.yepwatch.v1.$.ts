import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { yepWatchHandler } from '../server/yepwatch/runtime.server'
const handle=(request:Request)=>new URL(request.url).pathname.startsWith('/api/yepwatch/v1/continuous/') ? import('../server/yepwatch/continuous-runtime.server').then(module=>module.continuousRuntimeHandler(request)) : yepWatchHandler(request)
export const loader = ({ request }: LoaderFunctionArgs) => handle(request)
export const action = ({ request }: ActionFunctionArgs) => handle(request)
