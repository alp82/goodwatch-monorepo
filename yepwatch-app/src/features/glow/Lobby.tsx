import { guestOnly } from '../../core/config';
import { useEffect, useState } from 'react';
import { Image, Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { RoomCommand, RoomSnapshot, RoomPromptPreview } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi } from '../../core/continuous/api';
import { countryHint } from '../../core/lobby';
import { Field, Notice, Row } from '../../components/ui';
import { Drawer } from './Drawer';
import { GText, Pill, glow } from './theme';

const presets = ['Funny & light', 'A twisty thriller', 'Family night'];
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
      current?.country ??
        own.member.prefill?.country ??
        countryHint(Intl.DateTimeFormat().resolvedOptions().locale) ??
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
  providers.sort(
    (a, b) =>
      Number(b.selectionIds.some(id => services.includes(id))) - Number(a.selectionIds.some(id => services.includes(id))) ||
      ([8, 9, 337, 350].includes(b.id) ? 1 : 0) - ([8, 9, 337, 350].includes(a.id) ? 1 : 0)
  );
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
          {shared.description?.attributes.length ? (
            <Row>
              {shared.description.attributes.slice(0, compact ? 4 : 8).map((a, i) => (
                <View
                  key={i}
                  style={{
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: '#fbbf2418',
                  }}
                >
                  <GText size={12} color={glow.amber}>
                    {a.text}
                  </GText>
                </View>
              ))}
            </Row>
          ) : null}
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
        <Drawer title="Our room" close={() => setEditing(false)}>
          <GText bold size={20}>
            What sounds good?
          </GText>
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
          <GText size={12} color={glow.muted}>
            Type or use your keyboard’s microphone. Jev reads what you’re in the mood for.
          </GText>
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
            <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
              <GText size={12} color={glow.muted}>Jev’s read</GText>
              {liveReading ? (
                liveReading.attributes.length ? <Row>
                  {liveReading.attributes.map((a, i) => (
                    <View key={`${a.kind}:${a.key ?? a.text}:${i}`} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#fbbf2418' }}>
                      <GText size={12} color={glow.amber}>{a.kind === 'avoid' || a.kind === 'excluded' ? 'Not ' : ''}{a.text}</GText>
                    </View>
                  ))}
                </Row> : <GText size={12} color={glow.soft}>Using your words as written.</GText>
              ) : <GText size={12} color={glow.muted}>
                {prompt.trim().length < 2 ? 'Add a little more detail.' : !country ? 'Choose a country below to preview your picks.' : settledInput === inputKey && reading.error ? 'Jev couldn’t read this yet. Save to try again.' : 'Reading your prompt…'}
              </GText>}
            </View>
          )}
          <Row>
            {(
              ['movie', 'show_start', ...(canContinue ? (['show_continue'] as const) : [])] as const
            ).map((kind) => (
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
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: constraints.kinds.includes(kind) ? '#fbbf2430' : '#ffffff09',
                }}
              >
                <GText size={13}>
                  {kind === 'movie'
                    ? 'Movies'
                    : kind === 'show_start'
                    ? 'New shows'
                    : 'Continue my shows'}
                </GText>
              </Pressable>
            ))}
          </Row>
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
          <Pill label="Choose country" onPress={() => setCountryPicker((v) => !v)}>
            {country
              ? `${flag(country)} ${
                  metadata.data?.countries.find((c) => c.code === country)?.name ?? country
                }`
              : 'Choose country'}
          </Pill>
          {countryPicker && (
            <>
              <Field
                label="Find country"
                value={countrySearch}
                onChange={setCountrySearch}
                placeholder="Search countries"
              />
              {metadata.data?.countries
                .filter(
                  (c) =>
                    !countrySearch ||
                    `${c.name} ${c.code}`.toLowerCase().includes(countrySearch.toLowerCase())
                )
                .slice(0, 30)
                .map((c) => (
                  <Pill
                    key={c.code}
                    label={c.name}
                    gold={country === c.code}
                    onPress={() => {
                      setCountry(c.code);
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
          <Field
            label="Find streaming services"
            value={serviceSearch}
            onChange={setServiceSearch}
            placeholder="Netflix, Prime Video…"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {providers.slice(0, serviceSearch ? 40 : 12).map((s) => (
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
          {savedServiceIds.length ? (
            <Pill
              label="Use everyone’s saved services"
              onPress={() => {
                setUseSavedProviders(true);
                const available = new Set(metadata.data?.services.map((s) => s.id) ?? []);
                setServices(savedServiceIds.filter((id) => available.has(id)));
              }}
            >
              Use everyone’s saved services
            </Pill>
          ) : null}
          {metadata.isPending && <GText>Loading services…</GText>}
          {metadata.error && (
            <>
              <Notice error>Services couldn’t load.</Notice>
              <Pill label="Retry catalog" onPress={() => void metadata.refetch()}>
                Retry
              </Pill>
            </>
          )}
          {saveError && <Notice error>{saveError}</Notice>}
          <Pill
            label="Save room description"
            gold
            disabled={disabled || !valid || metadata.isFetching}
            onPress={() => void save()}
          >
            {disabled ? 'Saving…' : 'Save'}
          </Pill>
        </Drawer>
      )}
    </View>
  );
}
