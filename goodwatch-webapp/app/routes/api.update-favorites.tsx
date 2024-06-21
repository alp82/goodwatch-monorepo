import type { ActionFunctionArgs, ActionFunction } from '@remix-run/node'
import { updateFavorites } from '~/server/favorites.server'
import { getUserIdFromRequest } from '~/utils/auth'

export const action: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  const params = await request.json();
  const user_id = await getUserIdFromRequest({ request })

  return await updateFavorites({
    ...params,
    user_id,
  })
}