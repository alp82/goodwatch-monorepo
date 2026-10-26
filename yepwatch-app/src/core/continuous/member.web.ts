import type { RoomAccess } from '../credentials';
import { secureAuthorizeUrl } from './member-state';
import { continuousApi } from './api';
import { rememberMemberReturn, clearMemberReturn } from './web-member-return';
export async function beginMember(access: RoomAccess) {
  const result = await continuousApi.memberStart(access, {
    roomId: access.roomId,
    returnTo: `${window.location.origin}/room/${encodeURIComponent(access.roomId)}`,
    client: 'browser',
  });
  const destination = secureAuthorizeUrl(result.authorizeUrl);
  rememberMemberReturn(access.roomId);
  // Stay busy until navigation. Browser Back may restore this document from its cache.
  await new Promise<void>((resolve, reject) => {
    const resumed = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      window.removeEventListener('pageshow', resumed);
      clearMemberReturn();
      resolve();
    };
    window.addEventListener('pageshow', resumed);
    try { window.location.assign(destination); }
    catch (error) {
      window.removeEventListener('pageshow', resumed);
      clearMemberReturn();
      reject(error);
    }
  });
}
export async function finishMember(): Promise<string> {
  throw new Error(
    'Browser linking is verified by the API callback using your original room cookie. Reopen your room.'
  );
}
