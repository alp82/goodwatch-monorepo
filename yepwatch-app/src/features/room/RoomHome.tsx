/** /room/<id>: the screen for where the room is (setup, choosing, a proposal, Tonight); `?sheet=` opens one of its sheets. */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { showsProposal, type RoomView } from './model';
import { toRooms } from './nav';
import { isRoomSheet, useRoom } from './RoomProvider';
import { RoomStatus } from './RoomStatus';
import { Proposal } from './Decide';
import { RoomSetup, Waiting } from './Setup';
import { startedLive } from './start-progress';
import { Tonight } from './Tonight';
import { useBackAction } from '../shell/sheet-back';
import { Voting } from './Voting';

/**
 * The round started while this screen was open (setup became choosing): voting takes over in that
 * same render, its first card live at once and rising in (until the stage says it has played that
 * entry). Opening a room that's already choosing shows voting as it is.
 */
function useRoundEntry(view: RoomView | null) {
  const phase = view?.phase;
  const [seen, setSeen] = useState(phase);
  const [entering, setEntering] = useState(false);
  // Decided in the render that first sees the round.
  if (phase !== seen) {
    setSeen(phase);
    setEntering(startedLive(seen, phase));
  }
  const entered = useCallback(() => setEntering(false), []);
  return { entering, entered };
}

export function RoomHome() {
  const { state, view, entry, dismissedProposal, memberBusy, openSheet, leaving } = useRoom();
  const params = useLocalSearchParams<{ signin?: string; fresh?: string; sheet?: string }>();
  // An address with a sheet (/room/<id>/services and the like): open it over the room, once.
  useEffect(() => {
    if (!params.sheet) return;
    if (isRoomSheet(params.sheet)) openSheet(params.sheet);
    router.setParams({ sheet: undefined });
  }, [params.sheet, openSheet]);
  // Old links may carry arrival markers; they no longer orchestrate another screen handoff.
  useEffect(() => {
    if (params.signin || params.fresh) router.setParams({ signin: undefined, fresh: undefined });
  }, [params.signin, params.fresh]);
  const [servicesOffered, setServicesOffered] = useState(false);
  // Guests who just joined pick their services first: the room opens with Your services over it,
  // from its first paint.
  const picksServices = Boolean(view && !view.isHost && !view.member && view.myServiceIds === null && view.phase !== 'decided');
  useLayoutEffect(() => {
    if (!picksServices || servicesOffered || memberBusy) return;
    setServicesOffered(true); // eslint-disable-line react-hooks/set-state-in-effect
    openSheet('services');
  }, [picksServices, servicesOffered, memberBusy, openSheet]);
  const round = useRoundEntry(view);
  const setup = view?.phase === 'setup' || (view?.phase === 'choosing' && !view.me.inRound);
  useBackAction(toRooms, setup);
  // Leaving ends your access on purpose: the room stays as it was until the start page takes over.
  if (!view || ((state.terminal || state.access === null) && !leaving)) return <RoomStatus />;
  if (view.phase === 'decided') return <Tonight />;
  if (showsProposal(view, dismissedProposal)) return <Proposal />;
  if (view.phase === 'choosing' && view.me.inRound && !entry.required) return <Voting entering={round.entering} onEntered={round.entered} />;
  return view.isHost && view.phase === 'setup' ? <RoomSetup /> : <Waiting />;
}
