import { guestOnly } from '../../core/config';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { RoomPromptPreview, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import type { RoomSettingsValue } from './round';
import { continuousApi } from '../../core/continuous/api';
import { deviceCountryHint, rankedCountries } from '../../core/lobby';
import { Field, Notice, Row } from '../../components/ui';
import { ReadAs } from '../glow/ReadAs';
import { GText, Icon, glow } from '../glow/theme';
import { Action, Label, Panel } from '../shell/parts';
import { R } from '../shell/tokens';

const presets = ['funny comfort watch', 'A twisty thriller', 'Family night'];
export const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : '🌐';


/**
 * Mood, kinds, country and services for one room, prefilled from its current settings. Setup saves
 * them; Start again uses them for the next round. Nothing is sent until the submit action.
 */
export function RoomSettings({ snapshot, preview, disabled, action, busyLabel, submit, notice }: {
  snapshot: RoomSnapshot;
  preview: (input: { prompt: string; country: string; serviceIds: number[] }, signal: AbortSignal) => Promise<RoomPromptPreview>;
  disabled: boolean;
  action: string;
  busyLabel: string;
  submit: (value: RoomSettingsValue) => Promise<boolean>;
  notice?: string;
}) {
  const { shared, own } = snapshot;
  const current = shared.screens[0]; // Compatibility projection; there is one room selection.
  const [suggestedCountry] = useState(deviceCountryHint);
  const [country, setCountry] = useState(current?.country || own.member.prefill?.country || suggestedCountry || '');
  const [customServices, setServices] = useState<number[]>(current?.serviceIds ?? []);
  const [useSavedProviders, setUseSavedProviders] = useState(!current?.confirmed);
  const [constraints, setConstraints] = useState(shared.constraints);
  const [prompt, setPrompt] = useState(shared.description?.prompt ?? '');
  const [countryPicker, setCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savedServiceIds = shared.savedServiceIds ?? own.member.prefill?.serviceIds ?? [];
  const metadata = useQuery({ queryKey: ['continuous-metadata', country], queryFn: () => continuousApi.metadata(country || undefined) });
  const providerGroups = metadata.data?.providerGroups ?? metadata.data?.services.map((s) => ({ ...s, selectionIds: [s.id] })) ?? [];
  const availableProviders = new Set(metadata.data?.services.map((s) => s.id) ?? []);
  const selected = useSavedProviders ? [...new Set(savedServiceIds)].filter((id) => availableProviders.has(id)) : customServices;
  // One visual choice selects its catalog aliases together, including saved legacy IDs.
  const services = [...new Set(providerGroups.filter((p) => p.selectionIds.some((id) => selected.includes(id))).flatMap((p) => p.selectionIds))].sort((a, b) => a - b);
  const inputKey = JSON.stringify({ prompt: prompt.trim(), country, serviceIds: services });
  const [settledInput, setSettledInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSettledInput(inputKey), 650);
    return () => clearTimeout(timer);
  }, [inputKey]);
  const reading = useQuery({
    queryKey: ['room-prompt-preview', shared.roomId, settledInput],
    queryFn: ({ signal }) => preview(JSON.parse(settledInput), signal),
    enabled: Boolean(metadata.data) && !metadata.isFetching && prompt.trim().length >= 2 && /^[A-Z]{2}$/.test(country) && settledInput === inputKey,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const liveReading = settledInput === inputKey ? reading.data : undefined;
  const canContinue = !guestOnly && own.member.state === 'linked' && Boolean(own.member.prefill?.savedProgressAvailable);
  const unsupported = constraints.kinds.includes('show_continue') && !canContinue;
  const valid =
    metadata.data?.countries.some((c) => c.code === country) && services.length > 0 && constraints.kinds.length > 0 && !unsupported && (!prompt.trim() || prompt.trim().length >= 2);
  async function save() {
    setSaveError('');
    setSaving(true);
    const ok = await submit({ country, serviceIds: services, constraints: { ...constraints, moods: [] }, prompt: prompt.trim() }).catch(() => false);
    setSaving(false);
    if (!ok) setSaveError('Couldn’t save the room. Check the connection and try again.');
  }
  const providers = providerGroups.filter((s) => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase()));
  const toggle = (on: boolean) => ({ borderWidth: 1, borderColor: on ? glow.amber : glow.line, backgroundColor: on ? '#fbbf2430' : '#ffffff09', borderRadius: R.control });

  if (countryPicker)
    return (
      <Panel testID="country-panel">
        <Field label="Find country" value={countrySearch} onChange={setCountrySearch} placeholder="Search countries" />
        {rankedCountries(metadata.data?.countries ?? [], country, suggestedCountry)
          .filter((c) => !countrySearch || `${c.name} ${c.code}`.toLowerCase().includes(countrySearch.toLowerCase()))
          .map((c) => (
            <Action key={c.code} small gold={country === c.code} name={c.name} label={`${flag(c.code)} ${c.name}`} style={{ justifyContent: 'flex-start' }} onPress={() => {
              setCountry(c.code);
              setServiceSearch('');
              setServices([]);
              setUseSavedProviders(true);
              setCountryPicker(false);
              setCountrySearch('');
            }} />
          ))}
      </Panel>
    );
  return (
    <Panel testID="settings-panel" footer={<>
      {saveError ? <Notice error>{saveError}</Notice> : null}
      <Action gold name={action} label={saving || disabled ? busyLabel : action} disabled={saving || disabled || !valid || metadata.isFetching} onPress={() => void save()} />
    </>}>
      {notice ? <GText size={14} color={glow.soft}>{notice}</GText> : null}
      <Label>Mood</Label>
      <View style={{ gap: prompt.trim() ? 10 : 0 }}>
        <TextInput accessibilityLabel="Describe what to watch" placeholder="A cosy mystery, something like…" placeholderTextColor={glow.muted} value={prompt} onChangeText={setPrompt} maxLength={1000} multiline
          style={{ color: glow.ink, backgroundColor: '#ffffff09', borderRadius: R.control, padding: 14, fontSize: 17, fontFamily: 'Gabarito', minHeight: 86, textAlignVertical: 'top' }} />
        {!prompt.trim() ? (
          <Row>
            {presets.map((p) => (
              <Pressable key={p} accessibilityRole="button" accessibilityLabel={p} onPress={() => setPrompt(p)} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
                <GText size={12} color={glow.amber} style={{ textDecorationLine: 'underline' }}>{p}</GText>
              </Pressable>
            ))}
          </Row>
        ) : (
          <View accessibilityLiveRegion="polite" style={{ minHeight: 26 }}>
            {liveReading ? <ReadAs attributes={liveReading.attributes} />
              : prompt.trim().length >= 2 && country ? settledInput === inputKey && reading.error
                ? <GText size={12} color={glow.muted}>Couldn’t update picks. Try saving again.</GText>
                : <ActivityIndicator size="small" color={glow.amber} accessibilityLabel="Updating picks" style={{ alignSelf: 'flex-start' }} />
              : null}
          </View>
        )}
      </View>
      <Label>What are we watching?</Label>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['movie', 'show_start'] as const).map((kind) => (
          <Pressable key={kind} accessibilityRole="checkbox" accessibilityState={{ checked: constraints.kinds.includes(kind) }} aria-checked={constraints.kinds.includes(kind)}
            onPress={() => setConstraints((c) => ({ ...c, kinds: c.kinds.includes(kind) ? c.kinds.filter((k) => k !== kind) : [...c.kinds, kind] }))}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', ...toggle(constraints.kinds.includes(kind)) }}>
            <GText bold size={16}>{kind === 'movie' ? 'Movies' : 'Shows'}</GText>
          </Pressable>
        ))}
      </View>
      {canContinue && (
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Continue my shows" accessibilityState={{ checked: constraints.kinds.includes('show_continue') }} aria-checked={constraints.kinds.includes('show_continue')}
          onPress={() => setConstraints((c) => ({ ...c, kinds: c.kinds.includes('show_continue') ? c.kinds.filter((k) => k !== 'show_continue') : [...c.kinds, 'show_continue'] }))}
          style={{ paddingVertical: 14, paddingHorizontal: 16, ...toggle(constraints.kinds.includes('show_continue')) }}>
          <GText size={14} style={{ textAlign: 'center' }}>Continue my shows</GText>
        </Pressable>
      )}
      {constraints.maxMinutes !== null && <Action small label={`Up to ${constraints.maxMinutes} min · Remove limit`} onPress={() => setConstraints((c) => ({ ...c, maxMinutes: null }))} />}
      {unsupported && (
        <>
          <GText size={13} color={glow.muted}>Continuing shows requires GoodWatch saved progress.</GText>
          <Action small label="Use movies and new shows" onPress={() => setConstraints((c) => ({ ...c, kinds: ['movie', 'show_start'] }))} />
        </>
      )}
      <Label>Where are we watching?</Label>
      <Action small name="Choose country" label={country ? `${flag(country)} ${metadata.data?.countries.find((c) => c.code === country)?.name ?? country}` : 'Choose country'} style={{ justifyContent: 'flex-start' }} onPress={() => setCountryPicker(true)} />
      {country ? <>
        <View style={{ flexDirection: 'row', minHeight: 52, borderWidth: 1, borderColor: '#595959', borderRadius: R.control, overflow: 'hidden', backgroundColor: '#0f0f0f' }}>
          <TextInput accessibilityLabel="Find streaming services" value={serviceSearch} onChangeText={setServiceSearch} placeholder="Netflix, Prime Video…" placeholderTextColor="#999" autoCapitalize="none" autoCorrect={false} returnKeyType="done" submitBehavior="blurAndSubmit"
            style={{ flex: 1, minWidth: 0, padding: 12, color: glow.ink, fontFamily: 'Gabarito', fontSize: 17 }} />
          {savedServiceIds.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Use everyone’s saved services" accessibilityState={{ selected: useSavedProviders }}
              onPress={() => { setUseSavedProviders(true); setServices(savedServiceIds.filter((id) => availableProviders.has(id))); }}
              style={({ pressed }) => ({ minWidth: 96, minHeight: 48, paddingHorizontal: 12, gap: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#595959', backgroundColor: pressed || useSavedProviders ? '#fbbf2426' : '#ffffff08' })}>
              <Icon name="people" size={16} color={glow.amber} />
              <GText size={12} color={glow.amber}>Everyone’s</GText>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {providers.map((s) => {
            const on = s.selectionIds.some((id) => services.includes(id));
            return (
              <Pressable key={s.id} accessibilityRole="checkbox" accessibilityLabel={s.name} accessibilityState={{ checked: on }} aria-checked={on}
                onPress={() => { setUseSavedProviders(false); setServices(on ? services.filter((id) => !s.selectionIds.includes(id)) : [...new Set([...services, ...s.selectionIds])]); }}
                style={({ pressed }) => ({ width: 78, minHeight: 94, padding: 8, borderRadius: R.card, alignItems: 'center', gap: 7, borderWidth: 2, borderColor: on ? glow.amber : 'transparent', backgroundColor: pressed ? '#fbbf2420' : '#ffffff08' })}>
                {s.logoUrl ? <Image source={{ uri: s.logoUrl }} style={{ width: 44, height: 44, borderRadius: R.control }} />
                  : <View style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><GText bold>{s.name.slice(0, 2)}</GText></View>}
                <GText size={10} lines={2} style={{ textAlign: 'center' }}>{s.name}</GText>
              </Pressable>
            );
          })}
        </View>
        <GText size={12} color={glow.muted}>Defaults combine everyone’s saved GoodWatch services available in this country. You can change them for this room. Paid rentals aren’t included.</GText>
        {metadata.data && !metadata.isFetching && !providers.length && <GText color={glow.muted}>{serviceSearch ? 'No matching services. Try another name.' : 'No services are listed for this country yet.'}</GText>}
      </> : <GText color={glow.muted}>Choose your country to see its streaming services.</GText>}
      {metadata.isPending && <GText>Loading services…</GText>}
      {metadata.error && <>
        <Notice error>Services couldn’t load.</Notice>
        <Action small label="Retry" onPress={() => void metadata.refetch()} />
      </>}
    </Panel>
  );
}
