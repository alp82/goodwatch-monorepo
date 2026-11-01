/** /room/<id>: the screen for where the room is (setup, choosing, a proposal, Tonight). */
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { guestOnly } from '../../core/config';
import { showsProposal } from './model';
import { openPage, toRooms } from './nav';
import { useRoom } from './RoomProvider';
import { RoomStatus } from './RoomStatus';
import { Proposal } from './Decide';
import { RoomSetup, Waiting } from './Setup';
import { Tonight } from './Tonight';
import { Voting } from './Voting';

export function RoomHome() {
  const { id, state, view, entry, dismissedProposal, signin } = useRoom();
  const params = useLocalSearchParams<{ signin?: string; fresh?: string }>();
  const steps = useRef({ signin: false, mood: false, services: false });
  // Arriving through sign-in: link the account once the room is known.
  useEffect(() => {
    if (guestOnly || params.signin !== '1' || !state.access || !view || steps.current.signin) return;
    steps.current.signin = true;
    router.setParams({ signin: undefined });
    if (!view.member) void signin();
  }, [params.signin, state.access, view, signin]);
  // A room that was just created opens on its Mood step (Back returns here).
  useEffect(() => {
    if (params.fresh !== '1' || !view || steps.current.mood) return;
    steps.current.mood = true;
    router.setParams({ fresh: undefined });
    if (view.isHost && !view.ideas.length) openPage(id, 'mood', { idea: 'new' });
  }, [params.fresh, view, id]);
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
