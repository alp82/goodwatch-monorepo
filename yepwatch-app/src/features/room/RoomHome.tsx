/** /room/<id>: the screen for where the room is (setup, choosing, a proposal, Tonight). */
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { guestOnly } from '../../core/config';
import { clearMoodStep, hasMoodStep, markMoodStep } from '../../core/continuous/room-local';
import { showsProposal } from './model';
import { openPage, toRooms } from './nav';
import { useRoom } from './RoomProvider';
import { RoomStatus } from './RoomStatus';
import { Proposal } from './Decide';
import { RoomSetup, Waiting } from './Setup';
import { Tonight } from './Tonight';
import { Voting } from './Voting';

export function RoomHome() {
  const { id, state, view, entry, dismissedProposal, signin, memberBusy } = useRoom();
  const params = useLocalSearchParams<{ signin?: string; fresh?: string }>();
  const steps = useRef({ signin: false, services: false });
  // The two arrival steps are independent: a room created through Continue with GoodWatch links the
  // account first, then opens Mood. The Mood step is noted on this device so it survives the sign-in
  // round trip (a full page load on the web).
  const signinWaiting = !guestOnly && params.signin === '1';
  useEffect(() => {
    if (params.fresh !== '1') return;
    markMoodStep(id);
    router.setParams({ fresh: undefined });
  }, [params.fresh, id]);
  // Arriving through sign-in: link the account once the room is known.
  useEffect(() => {
    if (guestOnly || params.signin !== '1' || !state.access || !view || steps.current.signin) return;
    steps.current.signin = true;
    router.setParams({ signin: undefined });
    if (!view.member) void signin();
  }, [params.signin, state.access, view, signin]);
  // A room that was just created opens on its Mood step (Back returns here), after any sign-in.
  useEffect(() => {
    if (!view || params.fresh === '1' || signinWaiting || memberBusy || !hasMoodStep(id)) return;
    clearMoodStep(id);
    if (view.isHost && !view.ideas.length) openPage(id, 'mood', { idea: 'new' });
  }, [params.fresh, view, id, signinWaiting, memberBusy]);
  // Guests who just joined pick their services first.
  useEffect(() => {
    if (!view || steps.current.services || view.isHost || view.member || view.myServiceIds !== null || view.phase === 'decided') return;
    steps.current.services = true;
    openPage(id, 'services');
  }, [view, id]);
  const setup = view?.phase === 'setup' || (view?.phase === 'choosing' && !view.me.inRound);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !setup) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { toRooms(); return true; });
    return () => sub.remove();
  }, [setup]));
  if (state.terminal || state.access === null || !view) return <RoomStatus />;
  if (view.phase === 'decided') return <Tonight />;
  if (showsProposal(view, dismissedProposal)) return <Proposal />;
  if (view.phase === 'choosing' && view.me.inRound && !entry.required) return <Voting />;
  return view.isHost && view.phase === 'setup' ? <RoomSetup /> : <Waiting />;
}
