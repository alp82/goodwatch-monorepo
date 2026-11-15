import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transientFailure, unanswered } from '../../core/continuous/backoff';
import { browserOffline, onBackOnline } from '../../core/continuous/network';
import { OFFLINE_WORDS, QUIET_OUTAGE_MS, RECONNECTING_WORDS } from '../../core/continuous/connection-words';
import { useLate, useLateSince } from '../../core/useLate';
import { RoomFailure } from '../../core/continuous/api';
import { ConnectionDetails } from '../rooms/ConnectionDetails';
import { CreateRoom } from '../../core/continuous/create-room';
import { ResendResume } from '../../core/continuous/resend-resume';
import { newRoomSave } from './new-room-save';
import { useAccount } from '../../core/continuous/account';
import { roomRegistry } from '../../core/continuous/room-registry';
import { useRetryCountdown } from '../../core/continuous/useRetryCountdown';
import { GText } from '../glow/theme';
import { BusyNote } from '../shell/floating-note';
import { useLayout } from '../shell/layout';
import { Actions, Button, Screen } from './ui';
import { useBackAction } from '../shell/sheet-back';
import { newRoomInFront, openCreatedRoom, preloadStartPages } from './nav';
import { noun } from '../shell/noun';

/**
 * New couch makes the couch at once and opens its setup, where ideas go in (no mood page first). This screen owns
 * the create-and-save operation until it succeeds: it shows nothing while the couch is made, one floating line
 * during an outage, and Try again only after a definitive refusal.
 */
export function NewRoom() {
  const account = useAccount();
  return <NewRoomDraft key={account.generation} account={account} />;
}

function NewRoomDraft({ account }: { account: ReturnType<typeof useAccount> }) {
  const [flow] = useState(() => new CreateRoom());
  const [text, setText] = useState<string | null>(null);
  const client = useQueryClient();
  const instance = useId();
  const draftKey = ['new-room-draft', account.generation, instance] as const;
  // Local and offline-aware: neither waits for React Query's online state (a paused create sat on Saving…).
  const draft = useQuery({ queryKey: draftKey, queryFn: () => flow.draft(), networkMode: 'always' });
  const [attempt] = useState(() => ({ current: null as AbortController | null }));
  // A slow or restarting server: the save keeps sending the same request by itself (create-room.ts). Offline:
  // an unanswered save goes again once the browser is back online. Both only while this page is in front:
  // leaving stops them (the saved request stays for a manual retry); the app out of the front (inactive or
  // background) pauses them until it is back (resend-resume.ts).
  const [resume] = useState(() => new ResendResume<string>());
  useFocusEffect(useCallback(() => { newRoomInFront(true); resume.focus(); return () => { newRoomInFront(false); resume.leave(); }; }, [resume]));
  // When the first failed attempt of this save began (null: none failed): drives the one connection line.
  const [troubleSince, setTroubleSince] = useState<number | null>(null);
  // Opened straight from an address: the room this draft becomes loads its code meanwhile.
  useEffect(preloadStartPages, []);
  const mutation = useMutation(newRoomSave({
    flow, resume, client, draftKey, text: () => text, setText, setTroubleSince, attempt,
    identity: async () => ({ nickname: (await roomRegistry.load()).nickname ?? account.name ?? '', member: account.member }),
    open: openCreatedRoom,
  }));
  useEffect(() => resume.connect({ send: mutation.mutate, abort: () => attempt.current?.abort() }), [resume, mutation.mutate, attempt]);
  const retrySeconds = useRetryCountdown(draft.data?.retryAt ?? 0);
  useEffect(() => onBackOnline(() => resume.online()), [resume]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => resume.appState(state));
    return () => { subscription.remove(); resume.leave(); };
  }, [resume]);
  const back = () => { resume.leave(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  useBackAction(back);
  const failure = mutation.error;
  const cancelled = failure?.name === 'AbortError';
  const offline = mutation.isError && !cancelled && unanswered(failure) && browserOffline();
  // Offline says so only after the quiet period (connection-words.ts); the room is created by itself when back.
  const offlineLate = useLate(offline, QUIET_OUTAGE_MS);
  const error = mutation.isError && !cancelled ? offline ? (offlineLate ? OFFLINE_WORDS : undefined) : transientFailure(failure) ? 'Couldn’t reach YepWatch. Your request is saved. Try again.' : failure instanceof RoomFailure && failure.code !== 'catalog_unavailable'
    ? failure.message : `Couldn’t make the ${noun.one}. Try again.` : undefined;
  // Saved: the button keeps saying Saving… until the room replaces this screen (no frame of Create room again).
  // Paused (the app left the front mid-save, e.g. iOS inactive under Control Center): it goes again by itself
  // when back, so no frame of Try again meanwhile.
  const saving = mutation.isPending || mutation.isSuccess || (cancelled && resume.phase === 'paused');
  // Owner rule Q24a: nothing for an outage under QUIET_OUTAGE_MS, then one small line floating over the page
  // (no layout shift, no countdown); the room still opens by itself when the answer comes.
  const reconnecting = useLateSince(saving ? troubleSince : null, QUIET_OUTAGE_MS);
  const disabled = saving || retrySeconds > 0 || !account.ready || draft.isPending;
  // The first press was New couch: the save starts by itself once the draft (and any saved wait) is known. A saved
  // request from an earlier visit goes again as it was.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || disabled || !draft.data) return;
    started.current = true;
    resume.pick(text ?? draft.data.text);
  }, [disabled, draft.data, resume, text]);
  return <NewCouchScreen back={back} note={reconnecting ? RECONNECTING_WORDS : undefined} error={error} disabled={disabled}
    details={error && failure instanceof RoomFailure && failure.diagnostic ? <ConnectionDetails diagnostic={failure.diagnostic} /> : undefined}
    retry={() => resume.pick(text ?? draft.data?.text ?? '')} />;
}

function NewCouchScreen({ back, note, error, details, disabled, retry }: { back: () => void; note?: string; error?: string; details?: ReactNode; disabled: boolean; retry: () => void }) {
  const { z } = useLayout();
  return (
    // While the couch is being made the screen is an empty frame for a moment (new-couch-wait); it becomes a screen
    // of its own (new-couch) only when it has something to say.
    <Screen testID={note || error ? 'new-couch' : 'new-couch-wait'} back={back} pill={{ label: noun.create, state: 'new' }}>
      {note ? <BusyNote text={note} /> : null}
      {error ? (
        <View style={{ gap: z(18), alignItems: 'center', paddingTop: z(48) }}>
          <View accessibilityLiveRegion="polite"><GText color="#fca5a5" size={15} style={{ textAlign: 'center' }}>{error}</GText></View>
          {details}
          <Actions style={{ width: z(340), maxWidth: '100%' }}><Button label="Try again" disabled={disabled} onPress={retry} /></Actions>
        </View>
      ) : null}
    </Screen>
  );
}
