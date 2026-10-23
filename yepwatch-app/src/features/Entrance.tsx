import { guestOnly } from '../core/config';
import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Drawer } from './glow/Drawer';
import { GText, Pill, Wordmark, glow } from './glow/theme';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Field } from '../components/ui';
import { continuousApi as api, RoomFailure as ApiFailure } from '../core/continuous/api';
import { loadAccess, nativeClient, saveAccess } from '../core/credentials';
import { inviteIntent, parseInvite } from '../core/invites';
import { queryClient } from '../core/providers';
import { continuousKey as roomKey } from '../core/continuous/useRoom';
import { saveInvite } from '../core/continuous/invite-store';
import { mergeRoom } from '../core/continuous/state';
import { readAdmission, writeAdmission } from '../core/continuous/storage';
import type { AdmissionRecovery } from '../core/continuous/recovery-state';
import { retainRequest, retryDeadline } from '../core/continuous/retry';
import { useRetryCountdown } from '../core/continuous/useRetryCountdown';

export function Entrance({ invite }: { invite?: string }) {
  const [joining, setJoining] = useState(Boolean(invite));
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(invite ?? '');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [checkingInvite, setCheckingInvite] = useState(Boolean(invite));
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const intent = invite ?? '';
  const [admission, setAdmission] = useState<AdmissionRecovery | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const retrySeconds = useRetryCountdown(admission?.retryAt ?? 0);
  useEffect(() => {
    let active = true;
    void readAdmission(intent).then((saved) => {
      if (!active) return;
      setAdmission(saved);
      if (saved) {
        setNickname(saved.request.nickname);
        setCode(saved.code);
        setJoining(Boolean(saved.code));
      }
      setRestoreFailed(false);
    }).catch(() => {
      if (active) {
        setRestoreFailed(true);
        setError('Could not restore your saved room request. Retry before creating another.');
      }
    }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [intent, restoreVersion]);
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
        await saveAccess({
          roomId,
          participantId: snapshot.own.participantId,
          token: access.token,
          expiresAt: snapshot.shared.expiresAt,
        });
        if (!active) return;
        queryClient.setQueryData(roomKey(roomId), mergeRoom(undefined, snapshot));
        await saveInvite(roomId, { code: invite, path: inviteIntent(invite) });
        queryClient.setQueryData(['continuous-invite', roomId], {
          code: invite,
          path: inviteIntent(invite),
        });
        await writeAdmission(intent, null);
        router.replace({ pathname: '/room/[id]', params: { id: roomId } });
      } catch (e) {
        if (!active) return;
        if (
          e instanceof ApiFailure &&
          ['unauthorized', 'not_found', 'expired', 'forbidden'].includes(e.code)
        )
          return;
        setError(
          'Could not check your existing room membership. Retry before joining so your place is preserved.'
        );
        setRecoveryBlocked(true);
      } finally {
        if (active) setCheckingInvite(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [invite, checkVersion, intent]);
  async function enter(join: boolean, member = false) {
    if (inFlight.current || restoring || restoreFailed || (admission && admission.intent !== intent) || Date.now() < (admission?.retryAt ?? 0)) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    let saved = admission;
    try {
      const cleanCode = join ? parseInvite(code) : '';
      if (join && !cleanCode)
        throw new Error('Enter the complete room code or YepWatch invitation link.');
      if (!saved) {
        const bytes = await Crypto.getRandomBytesAsync(32);
        saved = {
          request: {
            contractVersion: 3,
            commandId: Crypto.randomUUID(),
            admissionSecret: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
            nickname: nickname.trim(),
          },
          code: cleanCode,
          intent,
          retryAt: 0,
        };
      }
      // A prior failed write may have retained this request only in memory.
      // Persist the exact bootstrap before EVERY possible admission submit.
      await writeAdmission(intent, saved);
      setAdmission(saved);
      let result;
      if (saved.code) {
        const { roomId } = await api.resolve(saved.code);
        const stored = await loadAccess(roomId);
        // Manual code entry has the same recovery guard as a direct invitation.
        if (!nativeClient || stored) {
          try {
            const access = stored ?? { roomId, participantId: '', token: '', expiresAt: 0 };
            const snapshot = await api.snapshot(access);
            await saveAccess({
              roomId,
              participantId: snapshot.own.participantId,
              token: access.token,
              expiresAt: snapshot.shared.expiresAt,
            });
            queryClient.setQueryData(roomKey(roomId), mergeRoom(undefined, snapshot));
            await saveInvite(roomId, { code: saved.code, path: inviteIntent(saved.code) });
            queryClient.setQueryData(['continuous-invite', roomId], {
              code: saved.code,
              path: inviteIntent(saved.code),
            });
            await writeAdmission(intent, null);
            router.replace({
              pathname: '/room/[id]',
              params: { id: roomId, ...(member ? { signin: '1' } : {}) },
            });
            return;
          } catch (e) {
            if (
              !(e instanceof ApiFailure) ||
              !['unauthorized', 'not_found', 'expired', 'forbidden'].includes(e.code)
            )
              throw e;
          }
        }
        result = await api.join(roomId, { ...saved.request, inviteCode: saved.code }, stored ?? undefined);
      } else result = await api.create(saved.request);
      await saveAccess(result.credential);
      queryClient.setQueryData(
        roomKey(result.credential.roomId),
        mergeRoom(undefined, result.snapshot)
      );
      // Retain the invitation across OAuth navigation without exposing it to activity or telemetry.
      await saveInvite(result.credential.roomId, result.invite);
      queryClient.setQueryData(['continuous-invite', result.credential.roomId], result.invite);
      await writeAdmission(intent, null);
      setAdmission(null);
      router.replace({
        pathname: '/room/[id]',
        params: { id: result.credential.roomId, ...(member ? { signin: '1' } : {}) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join this room.');
      if (saved) {
        const next = retainRequest(e) ? { ...saved, retryAt: retryDeadline(e) } : null;
        setAdmission(next);
        try { await writeAdmission(intent, next); }
        catch { setError('Your request is still awaiting confirmation, but storage is unavailable. Keep this screen open to retry.'); }
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const landscape = height < 500 && width > height;
  const [options, setOptions] = useState(false);
  const locked = busy || checkingInvite || recoveryBlocked || restoring || restoreFailed || retrySeconds > 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: glow.bg, overflow: 'hidden' }}>
      <View
        style={{
          paddingHorizontal: 24,
          height: compact ? 48 : 60,
          flexShrink: 0,
          justifyContent: 'center',
        }}
      >
        <Wordmark />
      </View>
      <View
        style={{
          flex: 1,
          minHeight: 0,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: compact ? 12 : 24,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: landscape ? 880 : 420,
            gap: compact ? 12 : 18,
            flexDirection: landscape ? 'row' : 'column',
            alignItems: landscape ? 'center' : undefined,
          }}
        >
          <View style={{ flex: landscape ? 1 : undefined, gap: compact ? 8 : 18 }}>
            <GText size={compact ? 32 : 43} bold style={{ letterSpacing: -1.4 }}>
              Less browsing.{'\n'}More watching.
            </GText>
            {!compact && (
              <GText color={glow.muted}>
                {invite || joining
                  ? 'Join your friends and find your shared Yep.'
                  : 'Find something you’ll all want to watch.'}
              </GText>
            )}
          </View>
          <View style={{ flex: landscape ? 1 : undefined, gap: compact ? 10 : 18 }}>
            {error && (
              <GText size={14} lines={2} color="#fca5a5">
                {error}
              </GText>
            )}
            {restoreFailed && <Pill label="Retry saved request" onPress={() => {
              setRestoring(true); setError(''); setRestoreVersion(v => v + 1);
            }}>Retry saved request</Pill>}
            {retrySeconds > 0 && <GText size={13} color={glow.muted}>Try again in {retrySeconds}s. Your room request is saved.</GText>}
            {checkingInvite && (
              <GText size={14} color={glow.muted}>
                Restoring your place in the room…
              </GText>
            )}
            {recoveryBlocked && (
              <Pill
                label="Retry membership check"
                onPress={() => {
                  setRecoveryBlocked(false);
                  setCheckingInvite(true);
                  setError('');
                  setCheckVersion((v) => v + 1);
                }}
              >
                Retry membership check
              </Pill>
            )}
            <Field
              label="Your nickname"
              value={nickname}
              onChange={(v) => {
                if (!admission) setNickname(v);
              }}
              placeholder="What should we call you?"
            />
            {!invite && joining && (
              <Field
                label="Room code or invitation"
                value={code}
                onChange={(v) => {
                  if (!admission) setCode(v);
                }}
                placeholder="Paste the invitation link"
              />
            )}
            <Pill
              label={invite || joining ? 'Join room' : 'Create a room'}
              gold
              disabled={locked || !nickname.trim() || (joining && !code.trim())}
              onPress={() => void enter(Boolean(invite || joining))}
            >
              {retrySeconds > 0 ? `Retry in ${retrySeconds}s` : busy
                ? 'Connecting…'
                : admission
                ? 'Retry room request'
                : invite || joining
                ? 'Join room'
                : 'Create a room'}
            </Pill>
            {compact ? (
              <Pill label="More options" onPress={() => setOptions(true)}>
                More options
              </Pill>
            ) : (
              <>
                {!invite && (
                  <Pill
                    label={joining ? 'Create a room instead' : 'Join with an invitation'}
                    disabled={locked || Boolean(admission)}
                    onPress={() => {
                      setJoining((v) => !v);
                      setCode('');
                      setError('');
                    }}
                  >
                    {joining ? 'Create a room instead' : 'Join with an invitation'}
                  </Pill>
                )}
                {!guestOnly && <Pill
                  label="Connect GoodWatch"
                  disabled={locked || !nickname.trim() || (joining && !code.trim())}
                  onPress={() => void enter(Boolean(invite || joining), true)}
                >
                  Connect GoodWatch
                </Pill>}
              </>
            )}
            <GText size={12} color={glow.muted}>
              {guestOnly ? 'Choose together. No account needed.' : 'No account needed. Connect GoodWatch to sign in or create an account for saved preferences and show progress.'}
            </GText>
            {admission && (
              <GText size={12} color={glow.muted}>
                Retry preserves your identity and room request.
              </GText>
            )}
          </View>
        </View>
      </View>
      {options && (
        <Drawer title="More ways to join" close={() => setOptions(false)}>
          {error && <GText size={14} color="#fca5a5">{error}</GText>}
          {!invite && (
            <Pill
              label={joining ? 'Create a room instead' : 'Join with an invitation'}
              disabled={locked || Boolean(admission)}
              onPress={() => {
                setJoining((v) => !v);
                setOptions(false);
                setCode('');
                setError('');
              }}
            >
              {joining ? 'Create a room instead' : 'Join with an invitation'}
            </Pill>
          )}
          {!guestOnly && <Pill
            label="Connect GoodWatch"
            disabled={locked || !nickname.trim() || (joining && !code.trim())}
            onPress={() => void enter(Boolean(invite || joining), true)}
          >
            Connect GoodWatch
          </Pill>}
        </Drawer>
      )}
    </SafeAreaView>
  );
}
