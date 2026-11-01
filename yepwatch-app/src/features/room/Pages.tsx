/** The room's sub-pages: Room (ideas, people, settings, leave), Streaming, Your services, Movies and shows. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import type { RoomConstraints } from '@goodwatch/yepwatch-contracts/proposal';
import { deviceCountryHint } from '../../core/lobby';
import { roomRegistry } from '../../core/continuous/room-registry';
import { Feedback } from '../beta/Feedback';
import { SoundToggle } from '../feedback/RoomFeedback';
import { GoodWatchMark } from '../shell/marks';
import { FaceStack } from '../shell/parts';
import { GText, Icon, Press, glow } from '../glow/theme';
import { bringers, type Kind, type RoomCommands } from './model';
import { leavePage, openPage } from './nav';
import { CountryLine, IdeaList, KindsPick, RoomLink, ServiceGrid } from './parts';
import { useRoom } from './RoomProvider';
import { RoomNotes, RoomStatus } from './RoomStatus';
import { RoomRows } from './Setup';
import { namesLine, servicesIn, toggleService } from './services';
import { Button, Logos, Section, Screen, Small, Switch, T, TextLink, card, useServices } from './ui';

function Page({ title, children, done = true, testID }: { title: string; children: ReactNode; done?: boolean; testID: string }) {
  const { id } = useRoom();
  return (
    <Screen testID={testID} back={() => leavePage(id)} footer={done ? <Button label="Done" onPress={() => leavePage(id)} /> : undefined}>
      <RoomNotes />
      <GText bold size={T.title} style={{ letterSpacing: -0.8 }}>{title}</GText>
      {children}
    </Screen>
  );
}

/** A labelled switch row. */
function SwitchRow({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <GText color={glow.soft} style={{ flex: 1 }}>{label}</GText>
      <Switch label={label} on={on} disabled={disabled} onPress={onPress} />
    </View>
  );
}

/** The room in one place: ideas, people and the link, movies and shows, streaming, leave. */
export function RoomPage() {
  const { id, view, cmd, disabled } = useRoom();
  if (!view) return <RoomStatus />;
  const leave = () => void cmd.leave().then(async (ok) => {
    if (!ok) return;
    await roomRegistry.markLeft(id, view.label).catch(() => undefined);
    router.replace('/');
  });
  return (
    <Page testID="room-page" title="Room" done={false}>
      <View style={{ gap: 8 }}><Section>Ideas</Section><IdeaList size={26} /></View>
      <View style={{ gap: 8 }}><Section>People</Section><RoomLink here /></View>
      <RoomRows kindsEditable={view.isHost} />
      {view.showSeen !== null && <SwitchRow label="Show titles I’ve seen" on={view.showSeen} disabled={disabled} onPress={() => void cmd.setShowSeen(!view.showSeen)} />}
      <SoundToggle />
      <TextLink label="Leave room" color="#f87171" disabled={disabled} onPress={leave} />
      <Feedback />
    </Page>
  );
}

/** Yours, and everyone's together; the host switches services off (final say). */
export function StreamingPage() {
  const { id, view, cmd, disabled } = useRoom();
  const { all } = useServices(view?.country);
  if (!view) return <RoomStatus />;
  const mine = view.myServiceIds ?? [];
  const mineList = servicesIn(all, mine);
  const inRoom = servicesIn(all, view.roomServiceIds);
  const enabledTiles = inRoom.filter((s) => !s.ids.every((sid) => view.disabledServiceIds.includes(sid)));
  return (
    <Page testID="streaming-page" title="Streaming">
      <View style={{ ...card, padding: 14, gap: 10 }}>
        <Section>Yours</Section>
        <Press label={`${mineList.length ? namesLine(mineList) : 'Add yours'}, change`} onPress={() => openPage(id, 'services')} style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, minHeight: 40 }}>
          {mineList.length ? <><Logos services={mineList} size={28} /><GText style={{ flex: 1 }} lines={1}>{namesLine(mineList)}</GText></> : <GText style={{ flex: 1 }} color={glow.amber}>Add yours</GText>}
          {view.member ? <GoodWatchMark size={16} /> : null}
          <Icon name="right" size={16} color={glow.muted} />
        </Press>
      </View>
      <View style={{ gap: 4 }}>
        <Section>In this room</Section>
        {inRoom.map((s) => {
          const isOn = !s.ids.every((sid) => view.disabledServiceIds.includes(sid));
          // While choosing, the last service stays on: the deck needs somewhere to watch.
          const last = isOn && view.phase === 'choosing' && enabledTiles.length === 1;
          return (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: isOn ? 1 : 0.45 }}>
              {s.logoUrl ? <Image source={{ uri: s.logoUrl }} accessible={false} style={{ width: 40, height: 40, borderRadius: 7 }} /> : <View style={{ width: 40, height: 40, borderRadius: 7, backgroundColor: '#ffffff12' }} />}
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
    </Page>
  );
}

/** Saves when the page closes (Done, Back, browser or system back): one command, never one per tap. */
function useSaveOnLeave(save: () => void) {
  const latest = useRef(save);
  useEffect(() => { latest.current = save; });
  useEffect(() => () => latest.current(), []);
}

async function saveServices(cmd: RoomCommands, patch: { country: string | null; picked: number[] | null }) {
  if (patch.country && !(await cmd.configure({ country: patch.country }))) return;
  if (patch.picked) await cmd.setServices(patch.picked);
}

/** Your own services (per person) and, for the host, the room's country. */
export function ServicesPage() {
  const { view, cmd, snapshot } = useRoom();
  const [country, setCountry] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[] | null>(null);
  const fallback = snapshot?.own.member.prefill?.country ?? deviceCountryHint() ?? 'US';
  const shown = country ?? view?.country ?? fallback;
  const { all, metadata } = useServices(shown);
  const selected = picked ?? view?.myServiceIds ?? [];
  useSaveOnLeave(() => {
    if (!view) return;
    const sorted = (a: number[]) => JSON.stringify([...a].sort((x, y) => x - y));
    const servicesChanged = picked !== null && (view.myServiceIds === null || sorted(picked) !== sorted(view.myServiceIds));
    const nextCountry = view.isHost && ((country !== null && country !== view.country) || (!view.country && servicesChanged)) ? shown : null;
    if (nextCountry || servicesChanged) void saveServices(cmd, { country: nextCountry, picked: servicesChanged ? picked : null });
  });
  if (!view) return <RoomStatus />;
  return (
    <Page testID="services-page" title="Your services">
      <CountryLine country={shown} countries={metadata.data?.countries ?? []} onChange={view.isHost ? (code) => { setCountry(code); setPicked([]); } : undefined} />
      <ServiceGrid all={all} loading={metadata.isPending} selected={selected} toggle={(s) => setPicked(toggleService(selected, s))} />
      {metadata.error ? <TextLink label="Retry" onPress={() => void metadata.refetch()} /> : null}
    </Page>
  );
}

/** Movies, shows, or both (host). */
export function KindsPage() {
  const { view, cmd, snapshot } = useRoom();
  const [kinds, setKinds] = useState<Kind[] | null>(null);
  useSaveOnLeave(() => {
    const constraints = snapshot?.shared.constraints;
    if (!kinds || !kinds.length || !constraints || !view || JSON.stringify([...kinds].sort()) === JSON.stringify([...view.kinds].sort())) return;
    const others = constraints.kinds.filter((k) => k !== 'movie' && k !== 'show_start');
    const next: RoomConstraints = { ...constraints, kinds: [...kinds, ...others] };
    void cmd.configure({ constraints: next });
  });
  if (!view) return <RoomStatus />;
  return (
    <Page testID="kinds-page" title="Movies and shows">
      <KindsPick kinds={kinds ?? view.kinds} set={setKinds} />
    </Page>
  );
}
