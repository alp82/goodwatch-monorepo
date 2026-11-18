/**
 * The room's sheets, over whichever room screen is in front: Room (ideas, people, settings, leave),
 * Your services, Streaming, Movies and shows, and People. Each keeps its action inside the sheet;
 * closing one returns to the sheet it was opened from.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { deviceCountryHint } from '../../core/lobby';
import { guestOnly } from '../../core/config';
import { accountRoomChanged, useAccount } from '../../core/continuous/account';
import { continuousApi } from '../../core/continuous/api';
import { roomRegistry } from '../../core/continuous/room-registry';
import { Feedback } from '../beta/Feedback';
import { GoodWatchButton, RECONNECTED_DETAIL, RECONNECT_GOODWATCH } from '../home/Landing';
import { Or } from '../home/start-parts';
import { SoundToggle } from '../feedback/RoomFeedback';
import { GoodWatchMark } from '../shell/marks';
import { FaceStack } from '../shell/parts';
import { Sheet } from '../shell/Sheet';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { GText, Icon, Press, glow, grow } from '../glow/theme';
import { bringers } from './model';
import { exitRoom, openPage, sheetHref } from './nav';
import { CountryLine, KindsPick, ServiceGrid, SettingRow, useAcknowledgeShownIdeas } from './parts';
import { useRoom, type RoomSheet } from './RoomProvider';
import { HowItWorksSheet } from './HowItWorks';
import { InviteSurface } from './invite';
import { RoomNotes } from './RoomStatus';
import { kindsOnLeave, servicesOnLeave, type DraftKey, type Drafts } from './settings-save';
import { namesLine, servicesIn, toggleService } from './services';
import { Button, KindIcons, Label, Logos, NewBadge, Small, Switch, TextLink, kindsLabel, useServices } from './ui';
import { noun } from '../shell/noun';

/** Draws the room's open sheet (the room layout hands this to the room). */
export function renderRoomSheet(sheet: RoomSheet) {
  switch (sheet) {
    case 'room': return <RoomMenuSheet />;
    case 'settings': return <SettingsSheet />;
    case 'services': return <ServicesSheet />;
    case 'streaming': return <StreamingSheet />;
    case 'kinds': return <KindsSheet />;
    case 'people': return <PeopleSheet />;
    case 'invite': return <InviteSurface />;
    case 'how': return <HowItWorksSheet />;
  }
}

/** An old /room/<id>/<sheet> address: the room with that sheet open. */
export function SheetAddress({ sheet }: { sheet: RoomSheet }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={sheetHref(id, sheet)} />;
}

/** Opens Invite friends (QR code and link) over this sheet. */
function InviteFriends({ onPress }: { onPress: () => void }) {
  return (
    <Press label="Invite friends, show QR code and link" onPress={onPress}
      style={{ minHeight: 52, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.lineStrong }}>
      <Icon name="qr" size={18} color={glow.soft} />
      <GText bold size={15} style={{ flex: 1 }}>Invite friends</GText>
      <Icon name="right" size={16} color={glow.muted} />
    </Press>
  );
}

const Done = () => {
  const { closeSheet } = useRoom();
  return <Button label="Done" onPress={closeSheet} />;
};

/** The room in one place: its ideas, people and link, settings, archive and leave. */
function RoomMenuSheet() {
  const { id, view, cmd, disabled, closeSheet, openSheet, acknowledgeIdeas } = useRoom();
  const { z } = useLayout();
  useAcknowledgeShownIdeas(view, acknowledgeIdeas);
  if (!view) return null;
  const people = view.faces;
  return (
    <Sheet testID="room-sheet" title={noun.One} onClose={closeSheet}>
      <RoomNotes />
      <View style={{ gap: 2 }}>
        <Label>Ideas</Label>
        {view.ideas.map((i) => {
          const fresh = view.isHost && i.fresh && !i.mine;
          const text = (
            <>
              <GText bold size={z(20)} color={i.on ? glow.ink : '#8c8478'} lines={2} style={{ flexShrink: 1 }}>{i.text}</GText>
              {fresh ? <NewBadge /> : null}
              {!i.mine && i.author?.nickname ? <Small lines={1}>{i.author.nickname}</Small> : null}
              {i.mine ? <Icon name="pencil" size={16} color={glow.muted} /> : null}
              <View style={{ flex: 1 }} />
            </>
          );
          return (
            <SettingRow key={i.id} label={i.mine ? `${i.text}, edit` : i.text} onPress={i.mine ? () => openPage(id, 'mood', { idea: i.id }) : undefined}
              right={<Switch on={i.on} label={`Use ${i.text}`} disabled={!view.isHost || disabled} onPress={() => void cmd.setIdea(i.id, !i.on)} />}>
              {text}
            </SettingRow>
          );
        })}
        {!view.ideas.length ? <Small>No ideas yet</Small> : null}
        {view.canAddIdea ? <TextLink label={view.isHost ? 'Add an idea' : 'Suggest an idea'} onPress={() => openPage(id, 'mood', { idea: 'new' })} /> : null}
      </View>
      <View style={{ gap: 10 }}>
        <Label>People</Label>
        <Press label={`${people.length < 2 ? 'Just you' : `${people.length} people`}, people`} onPress={() => openSheet('people')} style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, ...grow(40) }}>
          <FaceStack people={people} size={30} max={6} />
          <GText size={15} color={glow.soft} style={{ flex: 1 }}>{people.length < 2 ? 'Just you' : `${people.length} people`}</GText>
          <Icon name="right" size={16} color={glow.muted} />
        </Press>
        <InviteFriends onPress={() => openSheet('invite')} />
      </View>
      <RoomSettings label />
    </Sheet>
  );
}

/** The setup dock's Settings: only what the setup page doesn't show (its ideas and people are on it). */
function SettingsSheet() {
  const { closeSheet } = useRoom();
  return (
    <Sheet testID="room-sheet" title="Settings" onClose={closeSheet}>
      <RoomNotes />
      <RoomSettings />
    </Sheet>
  );
}

/**
 * The room's settings, then Archive and Leave and Feedback. Streaming reads like the setup page's row
 * did: a host without services adds them (Your services), a friend brings their own.
 */
function RoomSettings({ label = false }: { label?: boolean }) {
  const { id, view, cmd, disabled, openSheet, setNotice, saves } = useRoom();
  const account = useAccount();
  const { z } = useLayout();
  const { all } = useServices(view?.country);
  const [leaving, setLeaving] = useState<'ask' | 'sending' | null>(null);
  if (!view) return null;
  const leave = () => {
    setLeaving('sending');
    void cmd.leave().then(async (ok) => {
      if (!ok) { setLeaving(null); return; }
      if (!account.member) await roomRegistry.markLeft(id, view.label).catch(() => undefined);
      await accountRoomChanged(id, { leftLabel: view.label });
      exitRoom();
    });
  };
  const archive = () => {
    void (account.member ? continuousApi.archive(id, true).then(() => accountRoomChanged(id, { archivedAt: Date.now() })) : roomRegistry.archive(id))
      .then(exitRoom).catch(() => setNotice(`Couldn’t archive ${noun.this}. Try again.`));
  };
  const on = servicesIn(all, view.enabledServiceIds);
  // The catalog is still loading: the row stays blank instead of saying "none" and then changing its words.
  const loading = !all.length && view.enabledServiceIds.length > 0;
  const missing = !loading && !on.length && view.isHost;
  // The host decides the couch's services (Streaming); a friend brings their own (Your services).
  const streaming = missing || !view.isHost ? 'services' : 'streaming';
  // A change not yet confirmed shows at once (it waits in the room's drafts until the server answers).
  const kinds = saves.drafts.kinds ?? view.kinds;
  return (
    <>
      <View>
        {label ? <Label>Settings</Label> : null}
        <SettingRow label={`${kindsLabel(kinds)}${view.isHost ? ', change' : ''}`} onPress={view.isHost ? () => openSheet('kinds') : undefined}>
          <KindIcons kinds={kinds} size={20} /><GText color={glow.soft} style={{ flex: 1 }}>{kindsLabel(kinds)}</GText>
        </SettingRow>
        <SettingRow label={missing ? 'Streaming services, add' : `${on.length ? namesLine(on) : 'Streaming'}, change`} onPress={() => openSheet(streaming)}>
          {on.length ? <Logos services={on} /> : missing ? <Icon name="plus" size={18} color={glow.amber} /> : null}
          <GText bold={missing} color={on.length ? glow.soft : missing ? glow.amber : glow.muted} lines={1} style={{ flex: 1 }}>{on.length ? namesLine(on) : missing ? 'Add your streaming services' : loading ? '' : 'Nobody’s services yet'}</GText>
        </SettingRow>
        {view.showSeen !== null && (
          <SettingRow label="Show titles I’ve seen" right={<Switch on={view.showSeen} label="Show titles I’ve seen" disabled={disabled} onPress={() => void cmd.setShowSeen(!view.showSeen)} />}>
            <GText color={glow.soft} style={{ flex: 1 }}>Show titles I’ve seen</GText>
          </SettingRow>
        )}
        <SoundToggle />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Press label={`Archive ${noun.one}`} onPress={archive} style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: warm.line }}><GText bold color={glow.soft}>{`Archive ${noun.one}`}</GText></Press>
        <Press label={`Leave ${noun.one}`} disabled={disabled || Boolean(leaving)} onPress={() => setLeaving('ask')} style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#f8717140' }}><GText bold color="#f87171">{`Leave ${noun.one}`}</GText></Press>
      </View>
      {leaving ? (
        <View testID="leave-confirm" accessibilityLiveRegion="polite" style={{ gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#f8717140', backgroundColor: '#f8717110' }}>
          <GText bold size={z(18)}>{`Leave ${noun.this}?`}</GText>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Press label="Stay" disabled={leaving === 'sending'} onPress={() => setLeaving(null)} style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: warm.line }}><GText bold color={glow.soft}>Stay</GText></Press>
            <Press label="Leave" disabled={leaving === 'sending'} onPress={leave} style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: '#f87171' }}><GText bold color="#070707">{leaving === 'sending' ? 'Leaving…' : 'Leave'}</GText></Press>
          </View>
        </View>
      ) : null}
      <Feedback />
    </>
  );
}

/**
 * A sheet's draft lives in the room (not the sheet), so it outlives the sheet: it's held while the
 * sheet is open and handed over to be saved when it closes (Done, Close, the shade, Escape, Android
 * back, or leaving the screen), one command per change, never one per tap.
 */
function useDraftSheet<K extends DraftKey>(key: K, final: () => Drafts[K]) {
  const { saves } = useRoom();
  const { hold, release } = saves;
  const latest = useRef(final);
  useEffect(() => { latest.current = final; });
  useEffect(() => {
    hold(key);
    return () => release(key, latest.current());
  }, [key, hold, release]);
}

/** Your own services (per person) and, for the host, the room's country. */
function ServicesSheet() {
  const { view, prefillCountry, saves, closeSheet, signin, memberBusy, memberLapsed, disabled } = useRoom();
  // An unsaved change (from this visit or one still being saved) wins; otherwise the confirmed room.
  const draft = saves.drafts.services;
  const fallback = prefillCountry ?? deviceCountryHint() ?? 'US';
  const shown = draft?.country ?? view?.country ?? fallback;
  const { all, metadata } = useServices(shown);
  const selected = draft?.picked ?? view?.myServiceIds ?? [];
  useDraftSheet('services', () => (view ? servicesOnLeave(draft, view, shown) : draft));
  if (!view) return null;
  return (
    <Sheet testID="services-sheet" title="Your services" onClose={closeSheet} actions={<Done />}>
      <RoomNotes />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <CountryLine country={shown} countries={metadata.data?.countries ?? []} onChange={view.isHost ? (code) => saves.edit('services', { country: code, picked: [] }) : undefined} />
        </View>
        {view.member ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><GoodWatchMark size={16} /><Small>From GoodWatch</Small></View> : null}
      </View>
      <ServiceGrid all={all} loading={metadata.isPending} selected={selected} toggle={(s) => saves.edit('services', { country: draft?.country ?? null, picked: toggleService(selected, s) })} />
      {metadata.error ? <TextLink label="Retry" onPress={() => void metadata.refetch()} /> : null}
      {/* Guests can bring the services saved on GoodWatch instead; signing in comes back to this room. */}
      {!guestOnly && !view.member ? (
        <View style={{ gap: 14 }}>
          <Or />
          <GoodWatchButton {...(memberLapsed ? { label: RECONNECT_GOODWATCH, detail: RECONNECTED_DETAIL } : { detail: 'Brings the services saved on GoodWatch' })} disabled={memberBusy || disabled} onPress={() => void signin()} />
        </View>
      ) : null}
    </Sheet>
  );
}

/** Yours, and everyone's together; the host switches services off (final say). */
function StreamingSheet() {
  const { view, cmd, disabled, closeSheet, openSheet } = useRoom();
  const { all } = useServices(view?.country);
  if (!view) return null;
  const mineList = servicesIn(all, view.myServiceIds ?? []);
  const inRoom = servicesIn(all, view.roomServiceIds);
  const enabledTiles = inRoom.filter((s) => !s.ids.every((sid) => view.disabledServiceIds.includes(sid)));
  return (
    <Sheet testID="streaming-sheet" title="Streaming" onClose={closeSheet} actions={<Done />}>
      <RoomNotes />
      <View style={{ gap: 8 }}>
        <Label>Yours</Label>
        <Press label={`${mineList.length ? namesLine(mineList) : 'Add yours'}, change`} onPress={() => openSheet('services')}
          style={{ minHeight: 56, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.line }}>
          {mineList.length ? <><Logos services={mineList} size={28} /><GText lines={1} style={{ flex: 1 }}>{namesLine(mineList)}</GText></> : <GText color={glow.amber} style={{ flex: 1 }}>Add yours</GText>}
          {view.member ? <GoodWatchMark size={16} /> : null}
          <Icon name="right" size={16} color={glow.muted} />
        </Press>
      </View>
      <View style={{ gap: 2 }}>
        <Label>{`In ${noun.this}`}</Label>
        {inRoom.map((s) => {
          const isOn = !s.ids.every((sid) => view.disabledServiceIds.includes(sid));
          // While choosing, the last service stays on: the deck needs somewhere to watch.
          const last = isOn && view.phase === 'choosing' && enabledTiles.length === 1;
          return (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, opacity: isOn ? 1 : 0.45 }}>
              {s.logoUrl ? <Image source={{ uri: s.logoUrl }} accessible={false} style={{ width: 40, height: 40, borderRadius: 9 }} /> : <View style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: '#2a2621' }} />}
              <View style={{ flex: 1, gap: 4 }}>
                <GText bold size={15} lines={1}>{s.name}</GText>
                <FaceStack people={bringers(view, s.ids).map((p) => ({ id: p.id, nickname: p.nickname || '?', self: p.self }))} size={18} max={4} />
              </View>
              {view.isHost
                ? <Switch on={isOn} label={`Use ${s.name}`} disabled={disabled || last} onPress={() => void cmd.setServiceEnabled(s.ids, !isOn)} />
                : !isOn ? <Small>Off</Small> : null}
            </View>
          );
        })}
        {!inRoom.length && <Small>Nobody’s services yet</Small>}
      </View>
    </Sheet>
  );
}

/** Movies, shows, or both: the host decides; everyone else sees the choice. */
function KindsSheet() {
  const { view, saves, closeSheet } = useRoom();
  const draft = saves.drafts.kinds;
  useDraftSheet('kinds', () => (view?.isHost ? kindsOnLeave(draft, view) : undefined));
  if (!view) return null;
  return (
    <Sheet testID="kinds-sheet" title="Movies and shows" onClose={closeSheet} actions={<Done />}>
      <KindsPick kinds={draft ?? view.kinds} disabled={!view.isHost} set={(k) => saves.edit('kinds', k)} />
    </Sheet>
  );
}

/** Everyone in the room, and the link to bring more. */
function PeopleSheet() {
  const { view, closeSheet, openSheet } = useRoom();
  if (!view) return null;
  const picking = new Set(view.picking.map((p) => p.id));
  return (
    <Sheet testID="people-sheet" title="People" onClose={closeSheet} actions={<Done />}>
      <InviteFriends onPress={() => openSheet('invite')} />
      <View style={{ gap: 4 }}>
        {view.people.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
            <FaceStack people={[{ id: p.id, nickname: p.nickname || (p.self ? 'You' : '?'), self: p.self }]} size={36} max={1} />
            <GText size={17} lines={1} style={{ flex: 1 }}>{p.nickname || (p.self ? 'You' : 'Someone')}</GText>
            {p.self && view.member ? <GoodWatchMark size={16} /> : null}
            {picking.has(p.id) ? <Small>Picking services</Small> : null}
            {p.host ? <Small>Host</Small> : p.self ? <Small>You</Small> : null}
          </View>
        ))}
      </View>
    </Sheet>
  );
}
