import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type { CandidateKind, RoomCommand, RoomConstraints, RoomSnapshot, ScreenContext } from '@goodwatch/yepwatch-contracts';
import { api } from '../core/api';
import { ActivityDot, Button, Field, Heading, Notice, Panel, Row, Words, colors } from '../components/ui';

type Send = (command: RoomCommand) => void;
export function Participants({ snapshot, live }: { snapshot: RoomSnapshot; live: boolean }) {
  return <Panel><Words style={{ fontFamily: 'GabaritoBold' }}>In the room · {snapshot.shared.participants.length}</Words>{snapshot.shared.participants.map(p => <View key={p.participantId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ backgroundColor: colors.raised, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}><Words>{p.nickname.slice(0, 1).toUpperCase()}</Words></View>
    <View style={{ flex: 1 }}><Words>{p.nickname}{p.participantId === snapshot.own.participantId ? ' (you)' : ''}</Words><Words muted style={{ fontSize: 13 }}>{snapshot.shared.screens.find(s => s.id === p.screenId)?.label ?? 'Choose a screen'} · {p.participation === 'waiting' ? 'Next round' : p.ready ? 'Ready' : 'Setting up'}</Words></View>
    <ActivityDot active={live && p.presence === 'connected'} />
    <Words muted style={{ fontSize: 13 }}>{snapshot.shared.round ? `${p.completedCount}/${snapshot.shared.round.candidateCount}` : live && p.presence === 'connected' ? 'Here' : 'Presence unknown'}</Words>
  </View>)}</Panel>;
}
const kindLabels: Record<CandidateKind, string> = { movie: 'Movies', show_start: 'Shows to start', show_continue: 'Shows to continue' };
export function Setup({ snapshot, disabled, send }: { snapshot: RoomSnapshot; disabled: boolean; send: Send }) {
  const { shared, own } = snapshot; const me = shared.participants.find(p => p.participantId === own.participantId);
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(shared.constraints);
  const [minutes, setMinutes] = useState(shared.constraints.maxMinutes?.toString() ?? '');
  const [screens, setScreens] = useState<ScreenContext[]>(shared.screens); const [screenId, setScreenId] = useState(me?.screenId ?? shared.screens[0]?.id ?? '');
  const [filter, setFilter] = useState(''); const [countryFilter, setCountryFilter] = useState('');
  const selected = screens.find(s => s.id === screenId);
  const metadata = useQuery({ queryKey: ['metadata', selected?.country], queryFn: () => api.metadata(selected?.country ?? undefined), enabled: editing });
  const changeScreen = (patch: Partial<ScreenContext>) => setScreens(current => current.map(s => s.id === screenId ? { ...s, ...patch, confirmed: false } : s));
  function edit() { setDraft(shared.constraints); setMinutes(shared.constraints.maxMinutes?.toString() ?? ''); setScreens(shared.screens); setScreenId(me?.screenId ?? shared.screens[0]?.id ?? ''); setEditing(true); }
  function save() {
    const constraints: RoomConstraints = { ...draft, maxMinutes: minutes.trim() ? Number(minutes) : null };
    send({ type: 'setup', expectedContextVersion: shared.contextVersion, constraints, screens, screenId: screenId || null }); setEditing(false);
  }
  return <>
    <Heading>Who’s watching where?</Heading><Words muted>Phones are for voting. A viewing screen is one playback: share a TV or add a separate screen.</Words>
    <Panel>{shared.screens.map(screen => <View key={screen.id} style={{ gap: 6 }}><Words style={{ fontFamily: 'GabaritoBold' }}>{screen.label}</Words><Words muted>{screen.country ?? 'Country needed'} · {screen.serviceIds.length} usable services · {screen.confirmed ? 'Confirmed' : 'Needs confirmation'}</Words><Button secondary disabled={disabled || me?.screenId === screen.id} onPress={() => send({ type: 'assign_screen', expectedContextVersion: shared.contextVersion, screenId: screen.id })}>{me?.screenId === screen.id ? 'Watching here' : 'Watch on this screen'}</Button></View>)}
    <Words muted>{shared.constraints.kinds.map(k => kindLabels[k]).join(' · ')}{shared.constraints.maxMinutes ? ` · Up to ${shared.constraints.maxMinutes} minutes` : ''}</Words>
    {own.canHost ? <Button secondary disabled={disabled} onPress={edit}>Edit screens & evening</Button> : <Words muted>Watching elsewhere? Ask the host to add your screen, then select it here.</Words>}</Panel>
    {editing && <Panel>
      <Words style={{ fontFamily: 'GabaritoBold' }}>Your evening</Words><Row>{Object.entries(kindLabels).map(([key, label]) => <Button key={key} secondary selected={draft.kinds.includes(key as CandidateKind)} onPress={() => setDraft(d => ({ ...d, kinds: d.kinds.includes(key as CandidateKind) ? d.kinds.filter(k => k !== key) : [...d.kinds, key as CandidateKind] }))}>{label}</Button>)}</Row>
      <Field label="Time available in minutes (optional)" numeric value={minutes} onChange={setMinutes} placeholder="No time limit" />
      <Words>Mood (up to three)</Words><Row>{metadata.data?.moods.map(m => <Button key={m.id} secondary selected={draft.moods.includes(m.id)} disabled={!draft.moods.includes(m.id) && draft.moods.length >= 3} onPress={() => setDraft(d => ({ ...d, moods: d.moods.includes(m.id) ? d.moods.filter(id => id !== m.id) : [...d.moods, m.id] }))}>{m.label}</Button>)}</Row>
      <Words>Viewing screens</Words><Row>{screens.map(screen => <Button key={screen.id} secondary selected={screenId === screen.id} onPress={() => { setScreenId(screen.id); setFilter(''); }}>{screen.label}</Button>)}<Button secondary onPress={() => { const id = Crypto.randomUUID(); setScreens([...screens, { id, label: screens.length ? 'Another screen' : 'Our screen', country: null, serviceIds: [], confirmed: false }]); setScreenId(id); }}>{screens.length ? 'Watching elsewhere' : 'Add first screen'}</Button></Row>
      {selected && <><Field label="Screen name" value={selected.label} onChange={label => changeScreen({ label })} />
      <Field label="Find a country" value={countryFilter} onChange={setCountryFilter} placeholder="Search all catalog countries" />
      <Row>{metadata.data?.countries.filter(c => !countryFilter ? c.code === selected.country : c.name.toLowerCase().includes(countryFilter.toLowerCase()) || c.code.toLowerCase() === countryFilter.toLowerCase()).map(c => <Button key={c.code} secondary selected={selected.country === c.code} onPress={() => { changeScreen({ country: c.code, serviceIds: [] }); setCountryFilter(''); }}>{c.name}</Button>)}</Row>
      {!selected.country && !countryFilter && <Words muted>Search for the country where this screen will play.</Words>}
      <Field label="Find usable streaming services" value={filter} onChange={setFilter} placeholder="Search all services for this country" />
      <Row>{metadata.data?.services.filter(p => selected.serviceIds.includes(p.id) || (filter && p.name.toLowerCase().includes(filter.toLowerCase()))).map(p => <Button key={p.id} secondary selected={selected.serviceIds.includes(p.id)} onPress={() => changeScreen({ serviceIds: selected.serviceIds.includes(p.id) ? selected.serviceIds.filter(id => id !== p.id) : [...selected.serviceIds, p.id] })}>{p.name}</Button>)}</Row>
      <Words muted>Choose services that are usable on this screen tonight. Saved home subscriptions are only suggestions.</Words>
      <Button secondary selected={selected.confirmed} disabled={!selected.country || !selected.serviceIds.length} onPress={() => setScreens(current => current.map(s => s.id === selected.id ? { ...s, confirmed: !s.confirmed } : s))}>{selected.confirmed ? 'Screen confirmed' : 'Confirm this screen'}</Button></>}
      {metadata.isPending && <Words muted>Loading catalog choices…</Words>}{metadata.error && <><Notice error>Catalog choices could not load. No country or service has been substituted.</Notice><Button secondary onPress={() => void metadata.refetch()}>Retry catalog</Button></>}
      <Row><Button disabled={disabled || !draft.kinds.length || !screens.every(s => s.confirmed && s.label.trim()) || (Boolean(minutes) && (!Number.isInteger(Number(minutes)) || Number(minutes) < 1))} onPress={save}>Save evening</Button><Button secondary onPress={() => setEditing(false)}>Cancel</Button></Row>
    </Panel>}
    <Button disabled={disabled || !me?.screenId || !shared.screens.every(s => s.confirmed)} secondary={me?.ready} onPress={() => send({ type: 'ready', expectedContextVersion: shared.contextVersion, ready: !me?.ready })}>{me?.ready ? 'Ready — tap to change' : 'I’m ready'}</Button>
    {own.canHost && <Button disabled={disabled || !shared.participants.length || !shared.participants.every(p => p.ready)} onPress={() => send({ type: 'start_round', expectedRosterVersion: shared.rosterVersion, expectedContextVersion: shared.contextVersion })}>Start a short round</Button>}
    <Words muted>The round finishes before the shortlist appears. Screen changes require everyone to get ready again.</Words>
  </>;
}
