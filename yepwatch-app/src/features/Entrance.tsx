import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Button, Field, Heading, Notice, Page, Panel, Row, Words } from '../components/ui';
import { api, ApiFailure } from '../core/api';
import { loadAccess, nativeClient, saveAccess } from '../core/credentials';
import { fixturesEnabled } from '../core/config';
import { inviteIntent, parseInvite } from '../core/invites';
import { queryClient, roomKey } from '../core/providers';
import type { GuestAdmissionRequest } from '@goodwatch/yepwatch-contracts';

export function Entrance({ invite }: { invite?: string }) {
  const [guest, setGuest] = useState(false); const [joining, setJoining] = useState(Boolean(invite)); const [nickname, setNickname] = useState(''); const [code, setCode] = useState(invite ?? '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [checkingInvite, setCheckingInvite] = useState(Boolean(invite)); const [recoveryBlocked, setRecoveryBlocked] = useState(false); const [checkVersion, setCheckVersion] = useState(0);
  const [admission, setAdmission] = useState<{ request: GuestAdmissionRequest; code: string } | null>(null);
  useEffect(() => {
    if (!invite) return;
    let active = true;
    void (async () => {
      try {
        const { roomId } = await api.resolve(invite);
        const stored = await loadAccess(roomId);
        if (nativeClient && !stored) return;
        const access = stored ?? { roomId, participantId: '', token: '', expiresAt: 0 };
        const snapshot = await api.snapshot(access);
        if (!active) return;
        await saveAccess({ roomId, participantId: snapshot.own.participantId, token: access.token, expiresAt: snapshot.shared.expiresAt });
        if (!active) return;
        queryClient.setQueryData(roomKey(roomId), snapshot);
        queryClient.setQueryData(['invite', roomId], { code: invite, path: inviteIntent(invite) });
        router.replace({ pathname: '/room/[id]', params: { id: roomId } });
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiFailure && ['unauthorized', 'not_found', 'expired', 'forbidden'].includes(e.code)) return;
        setError('Could not check your existing room membership. Retry before joining so your place is preserved.'); setRecoveryBlocked(true);
      } finally { if (active) setCheckingInvite(false); }
    })();
    return () => { active = false; };
  }, [invite, checkVersion]);
  async function enter(join: boolean) {
    setBusy(true); setError('');
    try {
      const cleanCode = join ? parseInvite(code) : '';
      if (join && !cleanCode) throw new Error('Enter the complete room code or YepWatch invitation link.');
      let saved = admission;
      if (!saved) {
        const bytes = await Crypto.getRandomBytesAsync(32);
        saved = { request: { commandId: Crypto.randomUUID(), admissionSecret: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), nickname: nickname.trim() }, code: cleanCode };
        setAdmission(saved);
      }
      let result;
      if (saved.code) {
        const { roomId } = await api.resolve(saved.code);
        const stored = await loadAccess(roomId);
        // Manual code entry has the same recovery guard as a direct invitation.
        if (!nativeClient || stored) {
          try {
            const access = stored ?? { roomId, participantId: '', token: '', expiresAt: 0 };
            const snapshot = await api.snapshot(access);
            await saveAccess({ roomId, participantId: snapshot.own.participantId, token: access.token, expiresAt: snapshot.shared.expiresAt });
            queryClient.setQueryData(roomKey(roomId), snapshot); queryClient.setQueryData(['invite', roomId], { code: saved.code, path: inviteIntent(saved.code) });
            router.replace({ pathname: '/room/[id]', params: { id: roomId } }); return;
          } catch (e) { if (!(e instanceof ApiFailure) || !['unauthorized', 'not_found', 'expired', 'forbidden'].includes(e.code)) throw e; }
        }
        result = await api.join(roomId, { ...saved.request, inviteCode: saved.code });
      } else result = await api.create(saved.request);
      await saveAccess(result.credential);
      queryClient.setQueryData(roomKey(result.credential.roomId), result.snapshot);
      // Invitation is kept privately in this tab's query cache; never in activity or telemetry.
      queryClient.setQueryData(['invite', result.credential.roomId], result.invite);
      router.replace({ pathname: '/room/[id]', params: { id: result.credential.roomId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join this room.');
      if (e instanceof ApiFailure && !['outcome_unknown', 'busy'].includes(e.code)) setAdmission(null);
    } finally { setBusy(false); }
  }
  async function signIn() {
    setBusy(true); setError('');
    try {
      const intent = inviteIntent(parseInvite(code) || invite);
      const result = await api.memberStart({ returnTo: intent });
      const url = new URL(result.authorizeUrl);
      if (url.protocol !== 'https:') throw new Error('The sign-in destination is not secure.');
      if (Platform.OS === 'web') window.location.assign(url.href);
      else await WebBrowser.openAuthSessionAsync(url.href, Linking.createURL('auth/callback', { queryParams: { returnTo: intent } }));
    } catch (e) { setError(e instanceof ApiFailure && e.code === 'not_implemented' ? 'GoodWatch sign-in is not connected yet. You can continue as a guest; account progress will not be imported.' : e instanceof Error ? e.message : 'Sign-in could not start.'); }
    finally { setBusy(false); }
  }
  return <Page eyebrow={invite ? 'You’re invited' : 'Something good. Together.'}>
    <Heading>Less browsing.{'\n'}More watching.</Heading>
    <Words muted>Everyone gets a say. Then choose from your shared shortlist.</Words>
    {error && <Notice error>{error}</Notice>}
    {checkingInvite && <Notice>Checking whether you’re already in this room…</Notice>}
    {recoveryBlocked && <Button secondary onPress={() => { setRecoveryBlocked(false); setCheckingInvite(true); setError(''); setCheckVersion(v => v + 1); }}>Retry membership check</Button>}
    {!guest ? <Panel><Button onPress={() => setGuest(true)} disabled={busy || checkingInvite || recoveryBlocked}>Continue as guest</Button><Button secondary onPress={() => void signIn()} disabled={busy || checkingInvite || recoveryBlocked}>Sign in with GoodWatch</Button><Words muted>GoodWatch sign-in and saved show progress are not connected yet.</Words><Words muted>Your individual votes stay private. Shared results can still reveal preferences in small groups.</Words></Panel> : <Panel>
      <Words>{invite || joining ? 'Join your friends' : 'Create a room'}</Words>
      <Field label="Your nickname" value={nickname} onChange={v => { if (!admission) setNickname(v); }} placeholder="What should the room call you?" />
      {!invite && joining && <Field label="Room code or invitation link" value={code} onChange={v => { if (!admission) setCode(v); }} placeholder="Paste a link or enter a code" />}
      <Row><Button disabled={busy || !nickname.trim() || (joining && !code.trim())} onPress={() => void enter(Boolean(invite || joining))}>{busy ? 'Connecting…' : admission ? 'Retry room request' : invite || joining ? 'Join room' : 'Create a room'}</Button><Button secondary disabled={busy || Boolean(admission)} onPress={() => setGuest(false)}>Back</Button></Row>
      {!invite && <Button secondary disabled={busy || Boolean(admission)} onPress={() => { setJoining(v => !v); setCode(''); setError(''); }}>{joining ? 'Create a room instead' : 'Join with a code'}</Button>}
      {admission && <Words muted>Your room request is awaiting confirmation. Retry keeps the same identity and room intent.</Words>}
      <Words muted>One couch, separate screens, or a bit of both. No streaming account connection needed.</Words>
    </Panel>}
    {fixturesEnabled && <Button secondary onPress={() => router.push('/preview')}>Open isolated fixture preview</Button>}
  </Page>;
}
