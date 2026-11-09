/** /room/<id>: the screen for where the room is (setup, choosing, a proposal, Tonight); `?sheet=` opens one of its sheets. */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { clearMoodStep, hasMoodStep, markMoodStep } from '../../core/continuous/room-local';
import { showsProposal, type RoomView } from './model';
import { openPage, toRooms } from './nav';
import { isRoomSheet, useRoom } from './RoomProvider';
import { MoodArriving } from './MoodArriving';
import { RoomStatus } from './RoomStatus';
import { Proposal } from './Decide';
import { RoomSetup, Waiting } from './Setup';
import { FRIEND_HANDOVER_MS, START_HANDOVER_MS, startedLive } from './start-progress';
import { Tonight } from './Tonight';
import { useBackAction } from '../shell/sheet-back';
import { Voting } from './Voting';

/**
 * The round started while this screen was open: the room before Start stays a moment longer, showing
 * Ready with its check (the host) or "<host> started" (friends), then voting takes over. Opening a
 * room that's already choosing goes straight to voting.
 */
function useStartHandover(view: RoomView | null) {
  const phase = view?.phase;
  const [seen, setSeen] = useState(phase);
  const [handover, setHandover] = useState(false);
  // Decided in the render that first sees the round, so voting never paints a frame before the handover.
  if (phase !== seen) {
    setSeen(phase);
    setHandover(startedLive(seen, phase));
  }
  const ms = view?.isHost ? START_HANDOVER_MS : FRIEND_HANDOVER_MS;
  useEffect(() => {
    if (!handover) return;
    const timer = setTimeout(() => setHandover(false), ms);
    return () => clearTimeout(timer);
  }, [handover, ms]);
  return handover && phase === 'choosing';
}

export function RoomHome() {
  const { id, state, view, entry, dismissedProposal, memberBusy, openSheet } = useRoom();
  const params = useLocalSearchParams<{ signin?: string; fresh?: string; sheet?: string }>();
  // An address with a sheet (/room/<id>/services and the like): open it over the room, once.
  useEffect(() => {
    if (!params.sheet) return;
    if (isRoomSheet(params.sheet)) openSheet(params.sheet);
    router.setParams({ sheet: undefined });
  }, [params.sheet, openSheet]);
  // The page this arrival opens takes the first paint, not the room underneath. A push lands a frame
  // or so after it's sent, so the placeholder stays until that page has taken over.
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  useFocusEffect(useCallback(() => () => setOpening(false), []));
  // The Mood step is noted on this device, so a reload of the arrival still opens it.
  const fresh = params.fresh === '1';
  useEffect(() => { if (fresh) markMoodStep(id); }, [fresh, id]);
  // Older sign-in addresses (?signin=1) only drop the marker: GoodWatch sign-in no longer starts in a room.
  useEffect(() => { if (params.signin) router.setParams({ signin: undefined }); }, [params.signin]);
  // A room that was just created opens on its Mood step (Back returns here). The marker in the address
  // is dropped as it opens; the step never waits for that to land (it doesn't, after New room from a room).
  useEffect(() => {
    if (!view || opened || !(fresh || hasMoodStep(id))) return;
    clearMoodStep(id);
    if (fresh) router.setParams({ fresh: undefined });
    if (view.isHost && !view.ideas.length) { setOpening(true); openPage(id, 'mood', { idea: 'new', arrival: '1' }); } // eslint-disable-line react-hooks/set-state-in-effect
    setOpened(true);
  }, [fresh, opened, view, id]);
  // Guests who just joined pick their services first: the room opens with Your services over it,
  // from its first paint.
  const picksServices = Boolean(view && !view.isHost && !view.member && view.myServiceIds === null && view.phase !== 'decided');
  useLayoutEffect(() => {
    if (!picksServices || opened || memberBusy) return;
    setOpened(true); // eslint-disable-line react-hooks/set-state-in-effect
    openSheet('services');
  }, [picksServices, opened, memberBusy, openSheet]);
  const handover = useStartHandover(view);
  const setup = view?.phase === 'setup' || (view?.phase === 'choosing' && !view.me.inRound);
  useBackAction(toRooms, setup);
  if (state.terminal || state.access === null || !view) return <RoomStatus />;
  const moodNext = view.isHost && !view.ideas.length && (fresh || hasMoodStep(id));
  if (opening || (!opened && moodNext)) return <MoodArriving back={toRooms} />;
  if (view.phase === 'decided') return <Tonight />;
  if (handover) return view.isHost ? <RoomSetup ready /> : <Waiting ready />;
  if (showsProposal(view, dismissedProposal)) return <Proposal />;
  if (view.phase === 'choosing' && view.me.inRound && !entry.required) return <Voting />;
  return view.isHost && view.phase === 'setup' ? <RoomSetup /> : <Waiting />;
}
