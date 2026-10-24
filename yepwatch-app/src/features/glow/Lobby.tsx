import { guestOnly } from '../../core/config';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { RoomCommand, RoomSnapshot, RoomPromptPreview } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi } from '../../core/continuous/api';
import { deviceCountryHint, rankedCountries } from '../../core/lobby';
import { Field, Notice, Row } from '../../components/ui';
import { Drawer } from './Drawer';
import { ReadAs } from './ReadAs';
import { GText, Icon, Pill, glow } from './theme';

const presets = ['funny comfort watch', 'A twisty thriller', 'Family night'];
const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
    : '🌐';

export function Lobby({
  snapshot,
  disabled,
  send,
  invite,
  preview,
}: {
  snapshot: RoomSnapshot;
  disabled: boolean;
  send: (c: RoomCommand) => Promise<boolean>;
  invite: () => void;
  preview: (input: { prompt: string; country: string; serviceIds: number[] }, signal: AbortSignal) => Promise<RoomPromptPreview>;
}) {
  const { shared, own } = snapshot;
  const { width, height } = useWindowDimensions();
  const compact = height < 600;
  const landscape = compact && width > height;
  const current = shared.screens[0]; // Compatibility projection; there is one room selection.
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [suggestedCountry] = useState(deviceCountryHint);
  const [country, setCountry] = useState(current?.country ?? '');
  const [customServices, setServices] = useState<number[]>(current?.serviceIds ?? []);
  const [useSavedProviders, setUseSavedProviders] = useState(!current?.confirmed);
  const savedServiceIds = shared.savedServiceIds ?? own.member.prefill?.serviceIds ?? [];

  const [countryPicker, setCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [constraints, setConstraints] = useState(shared.constraints);
  const [prompt, setPrompt] = useState(shared.description?.prompt ?? '');
  const metadata = useQuery({
    queryKey: ['continuous-metadata', country],
    queryFn: () => continuousApi.metadata(country || undefined),
    enabled: editing || Boolean(current?.confirmed),
  });
  const providerGroups = metadata.data?.providerGroups ?? metadata.data?.services.map(s => ({ ...s, selectionIds: [s.id] })) ?? [];
  const availableProviders = new Set(metadata.data?.services.map((s) => s.id) ?? []);
  const selected = useSavedProviders
    ? [...new Set(savedServiceIds)].filter(id => availableProviders.has(id))
    : customServices;
  // One visual choice selects its catalog aliases together, including saved legacy IDs.
  const services = [...new Set(providerGroups.filter(p => p.selectionIds.some(id => selected.includes(id))).flatMap(p => p.selectionIds))].sort((a,b) => a-b);
  const providerCount = providerGroups.filter(p => p.selectionIds.some(id => current?.serviceIds.includes(id))).length;
  const inputKey = JSON.stringify({ prompt: prompt.trim(), country, serviceIds: services });
  const [settledInput, setSettledInput] = useState('');
  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => setSettledInput(inputKey), 650);
    return () => clearTimeout(timer);
  }, [editing, inputKey]);
  const reading = useQuery({
    queryKey: ['room-prompt-preview', shared.roomId, settledInput],
    queryFn: ({ signal }) => preview(JSON.parse(settledInput), signal),
    enabled: editing && Boolean(metadata.data) && !metadata.isFetching && prompt.trim().length >= 2 && /^[A-Z]{2}$/.test(country) && settledInput === inputKey,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const liveReading = settledInput === inputKey ? reading.data : undefined;
  const canContinue =
    !guestOnly &&
    own.member.state === 'linked' &&
    Boolean(own.member.prefill?.savedProgressAvailable);
  const unsupported = constraints.kinds.includes('show_continue') && !canContinue;
  const setup = Boolean(current?.confirmed && current.country && current.serviceIds.length);
  const valid =
    metadata.data?.countries.some((c) => c.code === country) &&
    services.length > 0 &&
    constraints.kinds.length > 0 &&
    !unsupported &&
    (!prompt.trim() || prompt.trim().length >= 2);
  function edit() {
    setCountry(
      current?.country ||
        own.member.prefill?.country ||
        suggestedCountry ||
        ''
    );
    setServices(current?.serviceIds ?? []);
    setUseSavedProviders(!current?.confirmed);
    setConstraints(shared.constraints);
    setPrompt(shared.description?.prompt ?? '');
    setSaveError('');
    setEditing(true);
  }
  async function save() {
    setSaveError('');
    if (
      await send({
        type: 'configure',
        expectedContextVersion: shared.contextVersion,
        country,
        serviceIds: services,
        constraints: { ...constraints, moods: [] },
        prompt: prompt.trim(),
      })
    )
      setEditing(false);
    else
      setSaveError(
        'Couldn’t save the room description. Check the connection and try again. If an action is pending, close this panel and retry it.'
      );
  }
  const providers =
    providerGroups.filter(
      (s) => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase())
    ) ?? [];
  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        padding: compact ? 16 : 24,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: landscape ? 960 : 540,
          gap: compact ? 12 : 22,
          flexDirection: landscape ? 'row' : 'column',
          alignItems: landscape ? 'center' : undefined,
        }}
      >
        <View style={{ flex: landscape ? 1 : undefined, gap: 10 }}>
          <GText size={compact ? 30 : 42} bold>
            What are we watching?
          </GText>
          <GText size={compact ? 13 : 16} color={glow.muted}>
            {shared.description?.prompt || 'A little inspiration. A choice for everyone.'}
          </GText>
          {shared.description?.attributes.length ? <ReadAs attributes={shared.description.attributes} /> : null}
        </View>
        <View style={{ flex: landscape ? 1 : undefined, gap: compact ? 8 : 16 }}>
          {setup && (
            <GText size={14} color={glow.muted}>
              {flag(current!.country!)} {current!.country} · {providerCount || current!.serviceIds.length} streaming{' '}
              {(providerCount || current!.serviceIds.length) === 1 ? 'service' : 'services'}
            </GText>
          )}
          {own.canHost ? (
            <>
              <Pill
                label={setup ? 'Start choosing' : 'Set up our room'}
                gold
                disabled={disabled}
                onPress={() =>
                  setup
                    ? void send({
                        type: 'start',
                        expectedRosterVersion: shared.rosterVersion,
                        expectedContextVersion: shared.contextVersion,
                        hostReady: true,
                      })
                    : edit()
                }
              >
                {setup ? 'Start choosing' : 'Set up our room'}
              </Pill>
              {setup && (
                <Pill label="Edit room description and services" onPress={edit} disabled={disabled}>
                  Description & services
                </Pill>
              )}
            </>
          ) : (
            <GText color={glow.muted}>
              {setup ? 'Waiting for the host to start.' : 'The host is setting up the room.'}
            </GText>
          )}
          <Pill label="Invite friends" icon="people" onPress={invite}>
            Invite friends
          </Pill>
        </View>
      </View>
      {editing && (
        <Drawer title={countryPicker ? "Choose country" : "Our room"} close={() => countryPicker ? setCountryPicker(false) : setEditing(false)} footer={!countryPicker ? <View style={{ gap: 8 }}>
          {saveError && <Notice error>{saveError}</Notice>}
          <Pill
            label="Save room description"
            gold
            disabled={disabled || !valid || metadata.isFetching}
            onPress={() => void save()}
          >
            {disabled ? 'Saving…' : 'Save'}
          </Pill></View> : undefined}>
          {countryPicker && (
            <>
              <Field
                label="Find country"
                value={countrySearch}
                onChange={setCountrySearch}
                placeholder="Search countries"
              />
              {rankedCountries(metadata.data?.countries ?? [], country, suggestedCountry)
                .filter(
                  (c) =>
                    !countrySearch ||
                    `${c.name} ${c.code}`.toLowerCase().includes(countrySearch.toLowerCase())
                )
                .map((c) => (
                  <Pill
                    key={c.code}
                    label={c.name}
                    gold={country === c.code}
                    onPress={() => {
                      setCountry(c.code);
                      setServiceSearch('');
                      setServices([]);
                      setUseSavedProviders(true);
                      setCountryPicker(false);
                      setCountrySearch('');
                    }}
                  >
                    {flag(c.code)} {c.name}
                  </Pill>
                ))}
            </>
          )}
          {!countryPicker && <>
          <GText bold size={20}>
            What mood?
          </GText>
          <View style={{ gap: prompt.trim() ? 10 : 0 }}>
            <TextInput
              accessibilityLabel="Describe what to watch"
              placeholder="A cosy mystery, something like…"
              placeholderTextColor={glow.muted}
              value={prompt}
              onChangeText={setPrompt}
              maxLength={1000}
              multiline
              style={{
                color: glow.ink,
                backgroundColor: '#ffffff09',
                borderRadius: 16,
                padding: 16,
                fontSize: 17,
                minHeight: 86,
                textAlignVertical: 'top',
              }}
            />
            {!prompt.trim() ? (
              <Row>
                {presets.map(p => (
                  <Pressable key={p} accessibilityRole="button" accessibilityLabel={p}
                    onPress={() => setPrompt(p)}
                    style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
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
          <View style={{ gap: 12, paddingVertical: 8 }}>
            <GText bold size={20}>What are we watching?</GText>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(['movie', 'show_start'] as const).map((kind) => (
                <Pressable
                  key={kind}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: constraints.kinds.includes(kind) }}
                  aria-checked={constraints.kinds.includes(kind)}
                  onPress={() =>
                    setConstraints((c) => ({
                      ...c,
                      kinds: c.kinds.includes(kind)
                        ? c.kinds.filter((k) => k !== kind)
                        : [...c.kinds, kind],
                    }))
                  }
                  style={{
                    flex: 1,
                    minHeight: 68,
                    paddingHorizontal: 12,
                    paddingVertical: 22,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: constraints.kinds.includes(kind) ? glow.amber : glow.line,
                    backgroundColor: constraints.kinds.includes(kind) ? '#fbbf2430' : '#ffffff09',
                  }}
                >
                  <GText bold size={16}>{kind === 'movie' ? 'Movies' : 'Shows'}</GText>
                </Pressable>
              ))}
            </View>
            {canContinue && (
              <Pressable accessibilityRole="checkbox" accessibilityLabel="Continue my shows"
                accessibilityState={{ checked: constraints.kinds.includes('show_continue') }}
                aria-checked={constraints.kinds.includes('show_continue')}
                onPress={() => setConstraints(c => ({ ...c, kinds: c.kinds.includes('show_continue') ? c.kinds.filter(k => k !== 'show_continue') : [...c.kinds, 'show_continue'] }))}
                style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: constraints.kinds.includes('show_continue') ? glow.amber : glow.line, backgroundColor: constraints.kinds.includes('show_continue') ? '#fbbf2430' : '#ffffff09' }}>
                <GText size={14} style={{ textAlign: 'center' }}>Continue my shows</GText>
              </Pressable>
            )}
          </View>
          {constraints.maxMinutes !== null && (
            <Pill
              label="Remove previous runtime limit"
              onPress={() => setConstraints((c) => ({ ...c, maxMinutes: null }))}
            >
              Up to {constraints.maxMinutes} min · Remove limit
            </Pill>
          )}
          {unsupported && (
            <>
              <GText size={13} color={glow.muted}>
                Continuing shows requires GoodWatch saved progress.
              </GText>
              <Pill
                label="Use movies and new shows"
                onPress={() => setConstraints((c) => ({ ...c, kinds: ['movie', 'show_start'] }))}
              >
                Use movies and new shows
              </Pill>
            </>
          )}
          <GText bold size={20}>
            Where are we watching?
          </GText>
          <Pill label="Choose country" onPress={() => setCountryPicker(true)}>
            {country
              ? `${flag(country)} ${
                  metadata.data?.countries.find((c) => c.code === country)?.name ?? country
                }`
              : 'Choose country'}
          </Pill>
          {country ? <>
          <View style={{ gap: 8 }}>
            <GText>{providers.length} streaming services</GText>
            <View style={{ flexDirection: 'row', minHeight: 52, borderWidth: 1, borderColor: '#595959', borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f0f0f' }}>
              <TextInput accessibilityLabel="Find streaming services" value={serviceSearch}
                onChangeText={setServiceSearch} placeholder="Netflix, Prime Video…" placeholderTextColor="#999"
                autoCapitalize="none" autoCorrect={false}
                style={{ flex: 1, minWidth: 0, padding: 12, color: glow.ink, fontFamily: 'Gabarito', fontSize: 17 }} />
              {savedServiceIds.length ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Use everyone’s saved services"
                  accessibilityState={{ selected: useSavedProviders }}
                  onPress={() => {
                    setUseSavedProviders(true);
                    const available = new Set(metadata.data?.services.map(s => s.id) ?? []);
                    setServices(savedServiceIds.filter(id => available.has(id)));
                  }}
                  style={({ pressed }) => ({ minWidth: 96, minHeight: 48, paddingHorizontal: 12, gap: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#595959', backgroundColor: pressed || useSavedProviders ? '#fbbf2426' : '#ffffff08' })}>
                  <Icon name="people" size={16} color={glow.amber} />
                  <GText size={12} color={glow.amber}>Everyone’s</GText>
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {providers.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="checkbox"
                accessibilityLabel={s.name}
                accessibilityState={{ checked: s.selectionIds.some(id => services.includes(id)) }}
                aria-checked={s.selectionIds.some(id => services.includes(id))}
                onPress={() => {
                  setUseSavedProviders(false);
                  setServices(
                    s.selectionIds.some(id => services.includes(id))
                      ? services.filter((id) => !s.selectionIds.includes(id))
                      : [...new Set([...services, ...s.selectionIds])]
                  );
                }}
                style={({ pressed }) => ({
                  width: 78,
                  minHeight: 94,
                  padding: 8,
                  borderRadius: 14,
                  alignItems: 'center',
                  gap: 7,
                  borderWidth: 2,
                  borderColor: s.selectionIds.some(id => services.includes(id)) ? glow.amber : 'transparent',
                  backgroundColor: pressed ? '#fbbf2420' : '#ffffff08',
                })}
              >
                {s.logoUrl ? (
                  <Image
                    source={{ uri: s.logoUrl }}
                    style={{ width: 44, height: 44, borderRadius: 9 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <GText bold>{s.name.slice(0, 2)}</GText>
                  </View>
                )}
                <GText size={10} lines={2} style={{ textAlign: 'center' }}>
                  {s.name}
                </GText>
              </Pressable>
            ))}
          </View>
          <GText size={12} color={glow.muted}>
            Defaults combine everyone’s saved GoodWatch services available in this country. You can
            change them for this room. Paid rentals aren’t included.
          </GText>

          {metadata.data && !metadata.isFetching && !providers.length && <GText color={glow.muted}>
            {serviceSearch ? 'No matching services. Try another name.' : 'No services are listed for this country yet.'}
          </GText>}
          </> : <GText color={glow.muted}>Choose your country to see its streaming services.</GText>}
          {metadata.isPending && <GText>Loading services…</GText>}
          {metadata.error && (
            <>
              <Notice error>Services couldn’t load.</Notice>
              <Pill label="Retry catalog" onPress={() => void metadata.refetch()}>
                Retry
              </Pill>
            </>
          )}

          </>}
        </Drawer>
      )}
    </View>
  );
}
