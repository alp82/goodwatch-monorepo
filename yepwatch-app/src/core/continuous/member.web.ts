import type { RoomAccess } from '../credentials';
import { secureAuthorizeUrl } from './member-state';
import { continuousApi } from './api';
export async function beginMember(access: RoomAccess) {
  const result = await continuousApi.memberStart(access, {
    roomId: access.roomId,
    returnTo: `${window.location.origin}/room/${encodeURIComponent(access.roomId)}`,
    client: 'browser',
  });
  window.location.assign(secureAuthorizeUrl(result.authorizeUrl));
}
export async function finishMember(): Promise<string> {
  throw new Error(
    'Browser linking is verified by the API callback using your original room cookie. Reopen your room.'
  );
}
