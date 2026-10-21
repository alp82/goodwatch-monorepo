import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type { CandidateKind, RoomCommand, RoomConstraints, RoomSnapshot, ScreenContext } from '@goodwatch/yepwatch-contracts';
import { api } from '../core/api';
import { canHostStart, countryHint, guestKinds } from '../core/lobby';
import { ActivityDot, Button, Field, Heading, Notice, Panel, Row, Words, colors } from '../components/ui';

type Send = (command: RoomCommand) => Promise<boolean>;
export function Participants({ snapshot, live }: { snapshot: RoomSnapshot; live: boolean }) {
  return <Panel><Words style={{ fontFamily: 'GabaritoBold' }}>In the room · {snapshot.shared.participants.length}</Words>{snapshot.shared.participants.map(p => <View key={p.participantId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ backgroundColor: colors.raised, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}><Words>{p.nickname.slice(0, 1).toUpperCase()}</Words></View>
    <View style={{ flex: 1 }}><Words>{p.nickname}{p.participantId === snapshot.own.participantId ? ' (you)' : ''}</Words><Words muted style={{ fontSize: 13 }}>{snapshot.shared.screens.find(s => s.id === p.screenId)?.label ?? 'Joining'} · {p.participation === 'waiting' ? 'Next round' : p.ready ? 'Ready' : p.participantId === snapshot.shared.hostParticipantId && snapshot.shared.phase === 'setup' ? 'Hosting' : 'Getting ready'}</Words></View>
    <ActivityDot active={live && p.presence === 'connected'} />
    <Words muted style={{ fontSize: 13 }}>{snapshot.shared.round ? `${p.completedCount}/${snapshot.shared.round.candidateCount}` : live && p.presence === 'connected' ? 'Here' : 'Presence unknown'}</Words>
  </View>)}</Panel>;
}
const kindLabels: Record<CandidateKind, string> = { movie: 'Movies', show_start: 'New shows', show_continue: 'Continuing shows' };
export function Setup({ snapshot, disabled, send }: { snapshot: RoomSnapshot; disabled: boolean; send: Send }) {
  const { shared, own } = snapshot; const me = shared.participants.find(p => p.participantId === own.participantId);
  const legacy = shared.constraints.kinds.includes('show_continue');
  const [editing, setEditing] = useState(own.canHost && (!shared.screens.length || shared.screens.some(s => !s.confirmed)));
  const [advanced, setAdvanced] = useState(false); const [changeCountry, setChangeCountry] = useState(false);
  const [draft, setDraft] = useState(shared.constraints);
  const [minutes, setMinutes] = useState(shared.constraints.maxMinutes?.toString() ?? '');
  const firstScreen = () => shared.screens.length ? shared.screens : [{ id: 'shared-screen', label: 'Our screen', country: countryHint(Intl.DateTimeFormat().resolvedOptions().locale), serviceIds: [], confirmed: false }];
  const [screens, setScreens] = useState<ScreenContext[]>(firstScreen);
  const [screenId, setScreenId] = useState(me?.screenId ?? shared.screens[0]?.id ?? 'shared-screen');
  const [filter, setFilter] = useState(''); const [countryFilter, setCountryFilter] = useState('');
  const selected = screens.find(s => s.id === screenId);
  const metadata = useQuery({ queryKey: ['metadata', selected?.country], queryFn: () => api.metadata(selected?.country ?? undefined), enabled: editing });
  const country = metadata.data?.countries.find(c => c.code === selected?.country);
  const validScreen = (s: ScreenContext) => Boolean(s.country && s.serviceIds.length && s.label.trim());
  const valid = screens.length > 0 && screens.every(s => validScreen(s)) && Boolean(country) && draft.kinds.length > 0 && (!minutes.trim() || (Number.isInteger(Number(minutes)) && Number(minutes) > 0));
  const services = metadata.data?.services.filter(p => selected?.serviceIds.includes(p.id) || (filter ? p.name.toLowerCase().includes(filter.toLowerCase()) : [8, 9, 337, 350].includes(p.id))) ?? [];
  const changeScreen = (patch: Partial<ScreenContext>) => setScreens(current => current.map(s => s.id === screenId ? { ...s, ...patch, confirmed: false } : s));
  function edit() { setDraft(shared.constraints); setMinutes(shared.constraints.maxMinutes?.toString() ?? ''); setScreens(firstScreen()); setScreenId(me?.screenId ?? shared.screens[0]?.id ?? 'shared-screen'); setEditing(true); }
  async function save() {
    const constraints: RoomConstraints = { ...draft, maxMinutes: minutes.trim() ? Number(minutes) : null };
    // This explicit save confirms the displayed countries/services; no subscriptions are inferred.
    if (await send({ type: 'setup', expectedContextVersion: shared.contextVersion, constraints, screens: screens.map(s => ({ ...s, confirmed: true })), screenId })) setEditing(false);
  }
  async function ready() {
    const id = me?.screenId ?? shared.screens[0]?.id;
    if (!id) return;
    if (!me?.screenId && !await send({ type: 'assign_screen', expectedContextVersion: shared.contextVersion, screenId: id })) return;
    await send({ type: 'ready', expectedContextVersion: shared.contextVersion, ready: true });
  }
  return <>
    <Heading>Ready to pick?</Heading>
    {legacy && <Panel><Notice>Continuing shows requires GoodWatch sign-in with saved progress. Sign-in is not connected yet. This room still has its previous settings.</Notice>{own.canHost && <Button disabled={disabled} onPress={() => void send({ type: 'setup', expectedContextVersion: shared.contextVersion, constraints: { ...shared.constraints, kinds: guestKinds() }, screens: shared.screens, screenId: me?.screenId ?? shared.screens[0]?.id ?? null })}>Use movies & new shows</Button>}</Panel>}
    {editing && own.canHost && !legacy ? <Panel>
<Words style={{ fontFamily: 'GabaritoBold' }}>{selected?.label ?? 'Choose a screen'} · {country?.name ?? 'Choose your country'}</Words>
      <Button secondary disabled={disabled} onPress={() => setChangeCountry(v => !v)}>Change country</Button>
      {(changeCountry || !country) && <><Field label="Find a country" value={countryFilter} onChange={setCountryFilter} placeholder="Search all catalog countries" /><Row>{metadata.data?.countries.filter(c => countryFilter ? c.name.toLowerCase().includes(countryFilter.toLowerCase()) || c.code.toLowerCase() === countryFilter.toLowerCase() : c.code === selected?.country).map(c => <Button key={c.code} secondary selected={c.code === selected?.country} disabled={disabled} onPress={() => { changeScreen({ country: c.code, serviceIds: [] }); setCountryFilter(''); setChangeCountry(false); }}>{c.name}</Button>)}</Row></>}
      <Field label="Find usable streaming services" value={filter} onChange={setFilter} placeholder="Search every service" />
      <Row>{services.map(p => <Button key={p.id} secondary label={`${p.name} (service ${p.id})`} selected={selected?.serviceIds.includes(p.id)} disabled={disabled || !country} onPress={() => changeScreen({ serviceIds: selected!.serviceIds.includes(p.id) ? selected!.serviceIds.filter(id => id !== p.id) : [...selected!.serviceIds, p.id] })}>{p.name}</Button>)}</Row>
      {filter && !services.length && metadata.data && <Words muted>No services match that search. Try another name.</Words>}
      <Words muted>Confirm this country and the services you can use. No subscriptions are assumed.</Words>
      <Button secondary disabled={disabled} onPress={() => setAdvanced(v => !v)}>{advanced ? 'Hide optional settings' : 'More settings · screens, mood & time'}</Button>
      {advanced && <>
        <Row>{screens.map(s => <Button key={s.id} secondary selected={screenId === s.id} disabled={disabled} onPress={() => { setScreenId(s.id); setFilter(''); }}>{s.label}</Button>)}<Button secondary disabled={disabled} onPress={() => { const id = Crypto.randomUUID(); setScreens([...screens, { id, label: 'Another screen', country: null, serviceIds: [], confirmed: false }]); setScreenId(id); setFilter(''); setChangeCountry(true); }}>Add remote screen</Button></Row>
        {selected && <Field label="Screen name" value={selected.label} onChange={label => changeScreen({ label })} />}
        {screens.length > 1 && <><Button secondary disabled={disabled} onPress={() => { const remaining = screens.filter(s => s.id !== screenId); setScreens(remaining); setScreenId(remaining[0].id); }}>Remove this screen</Button><Words muted>People on a removed screen must choose another screen before getting ready.</Words></>}
        <Words muted>Each separate playback needs its own country and usable services. People sharing a TV share one screen.</Words>
        <Row>{guestKinds().map(key => <Button key={key} secondary selected={draft.kinds.includes(key)} disabled={disabled} onPress={() => setDraft(d => ({ ...d, kinds: d.kinds.includes(key) ? d.kinds.filter(k => k !== key) : [...d.kinds, key] }))}>{kindLabels[key]}</Button>)}</Row>
        <Field label="Time available in minutes (optional)" numeric value={minutes} onChange={setMinutes} placeholder="No time limit" />
        <Words>Mood (optional, up to three)</Words><Row>{metadata.data?.moods.map(m => <Button key={m.id} secondary selected={draft.moods.includes(m.id)} disabled={disabled || (!draft.moods.includes(m.id) && draft.moods.length >= 3)} onPress={() => setDraft(d => ({ ...d, moods: d.moods.includes(m.id) ? d.moods.filter(id => id !== m.id) : [...d.moods, m.id] }))}>{m.label}</Button>)}</Row>
        <Words muted>Continuing shows · requires GoodWatch sign-in and saved progress. Unavailable until account sign-in is connected.</Words>
      </>}
      {metadata.isPending && <Words muted>Loading catalog choices…</Words>}{metadata.error && <><Notice error>Catalog choices could not load. Your country and services have not been substituted.</Notice><Button secondary onPress={() => void metadata.refetch()}>Retry catalog</Button></>}
      <Button disabled={disabled || !valid || metadata.isFetching} onPress={() => void save()}>Use these services</Button>
      {shared.screens.length > 0 && <Button secondary disabled={disabled} onPress={() => setEditing(false)}>Cancel changes</Button>}
    </Panel> : !legacy && <>
      <Words muted>{shared.constraints.kinds.map(k => kindLabels[k]).join(' · ')}{shared.constraints.maxMinutes ? ` · Up to ${shared.constraints.maxMinutes} minutes` : ''} · Everyone finishes before the shortlist.</Words>
      {shared.screens.map(s => <Panel key={s.id}><Words style={{ fontFamily: 'GabaritoBold' }}>{s.label}</Words><Words muted>{s.country ?? 'Country needed'} · {s.serviceIds.length} selected services · {s.confirmed ? 'Confirmed' : 'Needs confirmation'}</Words>{shared.screens.length > 1 && me?.screenId !== s.id && <Button secondary disabled={disabled} onPress={() => void send({ type: 'assign_screen', expectedContextVersion: shared.contextVersion, screenId: s.id })}>Watch on {s.label}</Button>}</Panel>)}
      {own.canHost ? <><Button disabled={disabled || !canHostStart(snapshot)} onPress={() => void send({ type: 'start_round', expectedRosterVersion: shared.rosterVersion, expectedContextVersion: shared.contextVersion, hostReady: true })}>Start a short round</Button>{shared.participants.some(p => p.participantId !== own.participantId && !p.ready) && <Words muted>Waiting for friends to confirm they’re ready.</Words>}<Button secondary disabled={disabled} onPress={edit}>Change services or settings</Button></> : <>
        {me?.ready ? <Notice>You’re ready. Waiting for the host to start.</Notice> : <Button disabled={disabled || !shared.screens.length || !shared.screens.every(s => s.confirmed)} onPress={() => void ready()}>Ready on {shared.screens.find(s => s.id === me?.screenId)?.label ?? shared.screens[0]?.label ?? 'our screen'}</Button>}
        <Words muted>Watching elsewhere? Ask the host to add a separate screen in settings.</Words>
      </>}
    </>}
  </>;
}
