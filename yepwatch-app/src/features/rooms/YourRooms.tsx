/**
 * The returning start page (direction D): the greeting (with Continue with GoodWatch for guests), the
 * big New room / Join a room tiles, open rooms as poster-fan cards (LIVE, mood, status, faces), then
 * one compact Decided row that opens History. Desktop browsers add a Get the app card. With no rooms:
 * the greeting, "What are we watching?", the tiles and History when there is any.
 */
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import type { DecisionRecord } from '../../core/continuous/room-registry-state';
import { BootReveal } from '../home/BootReveal';
import { AppCard, installable } from '../home/install';
import { StartSignIn } from '../home/Landing';
import { Tiles } from '../home/start-parts';
import { GText, Icon, Press, glow, onePress } from '../glow/theme';
import { HeroIcon, LiveBadge, Note, TextLink } from '../room/ui';
import { FaceStack } from '../shell/parts';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { posterAt, timeAgo, type HomeRoom } from './home-model';

/** Three posters from the room's deck, fanned; three empty slots while the room has none. */
export function PosterFan({ posters, width, height }: { posters: readonly string[]; width: number; height: number }) {
  const pw = Math.min(width * 0.4, (height / 1.5) * 0.82);
  // Back left, back right, then the front poster on top.
  const at = [{ x: -width * 0.2, r: '-9deg', slot: 1 }, { x: width * 0.2, r: '9deg', slot: 2 }, { x: 0, r: '0deg', slot: 0 }];
  return (
    <View accessible={false} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {at.map((pos, i) => {
        const uri = posters[pos.slot];
        return (
          <View key={i} style={{ position: 'absolute', transform: [{ translateX: pos.x }, { rotate: pos.r }], boxShadow: '0 8px 24px rgba(0,0,0,0.6)', borderRadius: 8 }}>
            {uri
              ? <Image source={{ uri: posterAt(uri, pw > 130 ? 342 : 185) }} accessible={false} style={{ width: pw, height: pw * 1.5, borderRadius: 8, backgroundColor: warm.well }} />
              : <View testID="fan-slot" style={{ width: pw, height: pw * 1.5, borderRadius: 8, backgroundColor: i === 2 ? '#211b12' : '#17130d', borderWidth: 1, borderColor: '#fbbf2433', borderStyle: 'dashed' }} />}
          </View>
        );
      })}
    </View>
  );
}

/** An open room: its deck as a poster fan, LIVE, the room's ideas, its status and people. Archive sits on the card. */
function LiveCard({ room, width, now, open, archive, quiet }: { room: HomeRoom; width: number; now: number; open: () => void; archive: () => void; quiet: boolean }) {
  const { z } = useLayout();
  const fan = Math.round(width * 0.82);
  return (
    <View style={{ width }}>
      <Pressable accessibilityRole="button" accessibilityLabel={room.label} disabled={quiet} onPress={onePress(open)}
        style={({ pressed }) => ({ borderRadius: R.card, overflow: 'hidden', backgroundColor: warm.panel, borderWidth: 1, borderColor: room.hot ? warm.amberLine : '#ffffff12', opacity: pressed ? 0.85 : 1 })}>
        <View style={{ height: fan, overflow: 'hidden', backgroundColor: '#100e0a' }}>
          <PosterFan posters={room.posters} width={width} height={fan} />
          <View style={{ position: 'absolute', left: 10, top: 10 }}><LiveBadge /></View>
        </View>
        <View style={{ padding: z(14), gap: 6 }}>
          <GText bold size={width > 200 ? z(20) : 16} lines={2} style={{ letterSpacing: -0.4 }}>{room.label}</GText>
          <GText size={z(14)} color={room.hot ? glow.amber : glow.soft} lines={1}>{room.status}</GText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FaceStack people={room.people} size={z(22)} max={4} />
            <GText size={z(13)} color={glow.muted} lines={1} style={{ flex: 1 }}>{!room.own && room.hostNickname ? `${room.hostNickname}’s room` : timeAgo(room.openedAt, now)}</GText>
          </View>
        </View>
      </Pressable>
      <Press label={`Archive ${room.label}`} onPress={archive} style={{ position: 'absolute', right: 8, top: 8, width: 40, height: 40, borderRadius: R.control, backgroundColor: '#0a0908cc', borderWidth: 1, borderColor: warm.line }}>
        <HeroIcon name="archive" size={18} color={glow.soft} />
      </Press>
    </View>
  );
}

/** Decided rooms: one row with the count and small Tonight posters; opens History. */
function DecidedRow({ decisions, onPress }: { decisions: readonly DecisionRecord[]; onPress: () => void }) {
  const { phone, z } = useLayout();
  const pw = phone ? 34 : z(40);
  return (
    <Pressable testID="decided-row" accessibilityRole="button" accessibilityLabel={`Decided, ${decisions.length}, open History`} onPress={onePress(onPress)}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: z(14), paddingVertical: z(12), paddingHorizontal: z(16), borderRadius: R.card, borderWidth: 1, borderColor: hovered ? warm.lineStrong : warm.line, backgroundColor: hovered ? '#ffffff0a' : '#ffffff05', opacity: pressed ? 0.85 : 1 })}>
      <GText bold size={phone ? 20 : z(24)} style={{ letterSpacing: -0.4 }}>Decided</GText>
      <GText bold size={phone ? 15 : z(17)} color={glow.muted}>{String(decisions.length)}</GText>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row' }}>
        {decisions.slice(0, 5).map((d, i) => (
          <View key={d.id} style={{ marginLeft: i ? -pw * 0.28 : 0, borderRadius: 6, borderWidth: 2, borderColor: glow.bg, transform: [{ rotate: `${(i - 1) * 4}deg` }], overflow: 'hidden' }}>
            {d.posterUrl
              ? <Image source={{ uri: posterAt(d.posterUrl, 185) }} accessible={false} style={{ width: pw, height: pw * 1.5, backgroundColor: warm.well }} />
              : <View style={{ width: pw, height: pw * 1.5, backgroundColor: warm.well, alignItems: 'center', justifyContent: 'center' }}><Icon name="tickets" size={pw * 0.45} color={glow.amber} /></View>}
          </View>
        ))}
      </View>
      <Icon name="right" size={z(18)} color={glow.muted} />
    </Pressable>
  );
}

function HistoryButton({ onPress }: { onPress: () => void }) {
  const { z } = useLayout();
  return (
    <Press label="History" onPress={onPress} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 8, height: z(44), paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: warm.lineStrong }}>
      <Icon name="clock" size={z(16)} color={glow.soft} /><GText bold size={z(15)} color={glow.soft}>History</GText>
    </Press>
  );
}

export function YourRooms({ title, rooms, decisions, unavailable, loading, open, archive, archivedRoom, undoArchive, newRoom, join, retry, history, signIn, signingIn = false, lapsed = false, disabled, quiet }: {
  title: string;
  /** Rooms on the start page; the open ones become cards. */
  rooms: readonly HomeRoom[];
  decisions: readonly DecisionRecord[];
  unavailable: readonly { roomId: string }[];
  loading: boolean;
  open: (roomId: string) => void;
  archive: (roomId: string) => void;
  /** Just archived: Undo stays offered for a moment. */
  archivedRoom: boolean;
  undoArchive: () => void;
  newRoom: () => void;
  join: () => void;
  retry: () => void;
  /** History has something (decided, left or archived rooms). */
  history?: () => void;
  /** Guests: Continue with GoodWatch; a lapsed member: Reconnect GoodWatch. */
  signIn?: () => void;
  /** A GoodWatch sign-in is already starting: the button waits. */
  signingIn?: boolean;
  /** The session ran out: `signIn` is the small Reconnect GoodWatch, not the guest button. */
  lapsed?: boolean;
  disabled: boolean;
  /** A room is opening: the buttons rest without dimming. */
  quiet: boolean;
}) {
  const { phone, max, z } = useLayout();
  const [now] = useState(() => Date.now());
  const live = rooms.filter((r) => r.live);
  const blank = !live.length && !decisions.length && !loading;
  const gap = phone ? 12 : z(18);
  const cols = phone ? 2 : Math.max(3, Math.floor((max + gap) / (z(300) + gap)));
  const cardWidth = Math.floor((max - gap * (cols - 1)) / cols);
  const tiles = { newRoom, join, disabled, quiet };
  // As wide as the New room and Join tiles above it, on every window.
  const signInButton = signIn ? <StartSignIn height={phone ? 54 : z(54)} signIn={signIn} signingIn={signingIn} lapsed={lapsed} disabled={disabled} quiet={quiet} /> : null;
  const notes = (
    <>
      {archivedRoom ? <Note action={{ label: 'Undo', onPress: undoArchive }}>Room archived</Note> : null}
      {unavailable.length > 0 && (
        <TextLink color={glow.muted} onPress={retry} label={unavailable.length === 1 ? 'One room didn’t load. Retry' : `${unavailable.length} rooms didn’t load. Retry`} />
      )}
    </>
  );
  if (blank) {
    return (
      <View testID="home-rooms" style={{ gap: phone ? 24 : z(36) }}>
        <BootReveal index={0} style={{ gap: z(6) }}>
          <GText bold size={phone ? 34 : z(54)} style={{ letterSpacing: phone ? -1 : -1.6 }}>{title}</GText>
          <GText size={phone ? 17 : z(21)} color={glow.soft}>What are we watching?</GText>
        </BootReveal>
        <BootReveal index={1} style={{ gap: phone ? 12 : z(16) }}>
          <Tiles {...tiles} height={phone ? 170 : z(240)} />
          {signInButton}
        </BootReveal>
        {history ? (
          <BootReveal index={2} style={{ flexDirection: 'row' }}>
            <HistoryButton onPress={history} />
          </BootReveal>
        ) : null}
        {notes}
        {!phone && installable ? <BootReveal index={3}><AppCard /></BootReveal> : null}
      </View>
    );
  }
  return (
    <View testID="home-rooms" style={{ gap: phone ? 28 : z(40) }}>
      <BootReveal index={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <GText bold size={phone ? 30 : z(44)} style={{ flex: 1, letterSpacing: -1 }}>{title}</GText>
      </BootReveal>
      <BootReveal index={1} style={{ gap: phone ? 12 : z(16) }}>
        <Tiles {...tiles} height={phone ? 132 : z(184)} />
        {signInButton}
      </BootReveal>
      {live.length ? (
        <BootReveal index={2} style={{ gap: z(14) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <GText bold size={z(22)} style={{ letterSpacing: -0.4 }}>Open</GText>
            <GText size={z(16)} color={glow.muted}>{String(live.length)}</GText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {live.map((r) => <LiveCard key={r.roomId} room={r} width={cardWidth} now={now} open={() => open(r.roomId)} archive={() => archive(r.roomId)} quiet={quiet} />)}
          </View>
        </BootReveal>
      ) : loading ? <GText size={13} color={glow.muted}>Opening your rooms…</GText> : null}
      {notes}
      {decisions.length && history ? <BootReveal index={3}><DecidedRow decisions={decisions} onPress={history} /></BootReveal>
        : history ? <BootReveal index={3}><HistoryButton onPress={history} /></BootReveal> : null}
      {!phone && installable ? <BootReveal index={4}><AppCard /></BootReveal> : null}
    </View>
  );
}
