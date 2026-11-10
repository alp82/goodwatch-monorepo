import type { GuestAdmission } from '@goodwatch/yepwatch-contracts/proposal';
import { loadAccess, saveAccess } from '../credentials';
import { queryClient } from '../providers';
import { saveInvite } from './invite-store';
import { writePending } from './storage';
import { roomRegistry } from './room-registry';
import { authEpoch } from './account-flow';
import { mergeRoom } from './state';

/** Recovery adopts one session's command stream; another actor's pending intent never follows it. */
export async function adoptAccountRoom(admission: GuestAdmission, expectedEpoch = authEpoch.current()) {
  const current = () => { if (!authEpoch.isCurrent(expectedEpoch)) throw new Error('Sign-in changed'); };
  current();
  const access = admission.credential;
  const previous = await loadAccess(access.roomId);
  current();
  if (!previous || previous.participantId !== access.participantId || previous.token !== access.token || previous.sessionKey !== access.sessionKey)
    await writePending(access.roomId, null);
  if (admission.snapshot.own.member.state === 'linked') await roomRegistry.forgetAccountRoom(access.roomId);
  current();
  await saveAccess(access);
  current();
  await saveInvite(access.roomId, admission.invite);
  current();
  queryClient.setQueryData(['continuous-invite', access.roomId], admission.invite);
  queryClient.setQueryData(['proposal-room', access.roomId], mergeRoom(undefined, admission.snapshot));
  queryClient.setQueryData(['home-room', access.roomId], admission.snapshot);
  return access;
}
