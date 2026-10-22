import { guestOnly } from '../../core/config';
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type {
  RoomCommand,
  RoomSnapshot,
  ScreenContext,
} from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi } from '../../core/continuous/api';
import { countryHint } from '../../core/lobby';
import { Button, Field, Notice, Row, Words } from '../../components/ui';
import { Drawer } from './Drawer';
import { GText, Pill, glow } from './theme';
export function Lobby({
  snapshot,
  disabled,
  send,
  invite,
}: {
  snapshot: RoomSnapshot;
  disabled: boolean;
  send: (c: RoomCommand) => Promise<boolean>;
  invite: () => void;
}) {
  const { shared, own } = snapshot;
  const { width, height } = useWindowDimensions();
  const compact = height < 600;
  const landscape = compact && width > height;
  const me = shared.participants.find((p) => p.participantId === own.participantId);
  const [screenPicker, setScreenPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [screens, setScreens] = useState<ScreenContext[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [changeCountry, setChangeCountry] = useState(false);
  const [constraints, setConstraints] = useState(shared.constraints);
  const [minutes, setMinutes] = useState('');
  const canContinue =
    !guestOnly && own.member.state === 'linked' && Boolean(own.member.prefill?.savedProgressAvailable);
  const unsupportedContinuation = constraints.kinds.includes('show_continue') && !canContinue;
  const selected = screens.find((s) => s.id === selectedId);
  const metadata = useQuery({
    queryKey: ['continuous-metadata', selected?.country],
    queryFn: () => continuousApi.metadata(selected?.country ?? undefined),
    enabled: editing,
  });
  function edit() {
    const draft = shared.screens.length
      ? shared.screens
      : [
          {
            id: 'shared-screen',
            label: 'Our screen',
            country:
              own.member.prefill?.country ??
              countryHint(Intl.DateTimeFormat().resolvedOptions().locale),
            serviceIds: [],
            confirmed: false,
          },
        ];
    setScreens(draft);
    setSelectedId(me?.screenId ?? draft[0].id);
    setConstraints(shared.constraints);
    setMinutes(shared.constraints.maxMinutes?.toString() ?? '');
    setEditing(true);
  }
  function patch(change: Partial<ScreenContext>) {
    setScreens((old) =>
      old.map((s) => (s.id === selectedId ? { ...s, ...change, confirmed: false } : s))
    );
  }
  async function save() {
    if (
      await send({
        type: 'setup',
        expectedContextVersion: shared.contextVersion,
        screens: screens.map((s) => ({ ...s, confirmed: true })),
        constraints: { ...constraints, maxMinutes: minutes ? Number(minutes) : null },
        screenId: screens.some((s) => s.id === me?.screenId)
          ? me!.screenId
          : (screens[0]?.id ?? null),
      })
    )
      setEditing(false);
  }
  const popular = [8, 9, 337, 350];
  const quick = metadata.data?.services.some((s) => popular.includes(s.id))
    ? popular
    : (metadata.data?.services.slice(0, 4).map((s) => s.id) ?? []);
  const valid = Boolean(
    metadata.data &&
      screens.length &&
      screens.every(
        (s) =>
          s.label.trim() &&
          s.country &&
          metadata.data!.countries.some((c) => c.code === s.country) &&
          s.serviceIds.length
      ) &&
      constraints.kinds.length &&
      !unsupportedContinuation &&
      (!minutes || (Number.isInteger(Number(minutes)) && Number(minutes) > 0))
  );
  const setup =
    shared.screens.length > 0 &&
    shared.screens.every((s) => s.confirmed && s.country && s.serviceIds.length);
  const ready =
    setup && shared.participants.every((p) => p.participantId === own.participantId || p.ready);
  async function joinScreen(id: string) {
    if (me?.screenId === id) return true;
    return send({
      type: 'assign_screen',
      expectedContextVersion: shared.contextVersion,
      screenId: id,
    });
  }

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: compact ? 12 : 24,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: landscape ? 960 : 500,
          gap: compact ? 12 : 20,
          flexDirection: landscape ? 'row' : 'column',
          alignItems: landscape ? 'center' : undefined,
        }}
      >
        <View style={{ flex: landscape ? 1 : undefined, gap: compact ? 8 : 20 }}>
          <GText size={compact ? 32 : 44} bold style={{ letterSpacing: -1.5 }}>
            Something good.{'\n'}Together.
          </GText>
          {!compact && (
            <GText color={glow.muted}>Find your matches, then pick what to watch together.</GText>
          )}
        </View>
        <View style={{ flex: landscape ? 1 : undefined, gap: compact ? 8 : 20 }}>
          {setup && (
            <View
              style={{
                padding: compact ? 10 : 18,
                borderRadius: 20,
                backgroundColor: '#ffffff09',
                gap: 8,
              }}
            >
              {shared.screens
                .filter(
                  (s) =>
                    s.id ===
                    (me?.screenId ?? (shared.screens.length === 1 ? shared.screens[0]?.id : null))
                )
                .map((s) => (
                  <GText key={s.id} size={15} lines={2}>
                    {s.label} · {s.country} · {s.serviceIds.length} selected services
                  </GText>
                ))}
              {shared.screens.length > 1 && (
                <GText size={12} color={glow.muted}>
                  {shared.screens.length} viewing screens · Details in room
                </GText>
              )}
            </View>
          )}
          {own.canHost ? (
            <>
              <Pill
                label={setup ? 'Start choosing' : 'Choose our services'}
                gold
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
                disabled={disabled || (setup && !ready)}
              >
                {setup ? 'Start choosing' : 'Choose our services'}
              </Pill>
              {setup && !ready && (
                <GText color={glow.muted} size={14}>
                  Connecting friends to their viewing screens.
                </GText>
              )}
              {setup && (
                <Pill
                  label="Edit services and settings"
                  icon="settings"
                  onPress={edit}
                  disabled={disabled}
                >
                  Services & settings
                </Pill>
              )}
            </>
          ) : (
            <>
              <GText color={glow.muted}>
                {setup
                  ? me?.ready
                    ? 'Waiting for the host to start.'
                    : me?.screenId || shared.screens.length === 1
                      ? 'Connecting to your viewing screen…'
                      : 'Choose the screen you’ll watch on.'
                  : 'The host is choosing the country and services.'}
              </GText>
              {shared.screens.length > 1 && (
                <Pill
                  label={me?.screenId ? 'Choose another screen' : 'Choose your viewing screen'}
                  onPress={() => setScreenPicker(true)}
                  disabled={disabled}
                >
                  {me?.screenId ? 'Watching elsewhere?' : 'Choose your screen'}
                </Pill>
              )}
            </>
          )}
          <Pill label="Invite friends" icon="people" onPress={invite}>
            Invite friends
          </Pill>
        </View>
      </View>
      {screenPicker && (
        <Drawer title="Your viewing screen" close={() => setScreenPicker(false)}>
          {shared.screens.map((screen) => (
            <Pill
              key={screen.id}
              label={`Watch on ${screen.label}`}
              gold={me?.screenId === screen.id}
              disabled={disabled}
              onPress={() => {
                void joinScreen(screen.id).then((ok) => {
                  if (ok) setScreenPicker(false);
                });
              }}
            >
              {screen.label} · {screen.country}
            </Pill>
          ))}
        </Drawer>
      )}
      {editing && (
        <Drawer title="Where are we watching?" close={() => setEditing(false)}>
          <GText bold>
            {selected?.label} ·{' '}
            {metadata.data?.countries.find((c) => c.code === selected?.country)?.name ??
              'Choose country'}
          </GText>
          <Pill label="Change country" onPress={() => setChangeCountry((v) => !v)}>
            Change country
          </Pill>
          {(changeCountry || !selected?.country) && (
            <>
              <Field
                label="Find country"
                value={countrySearch}
                onChange={setCountrySearch}
                placeholder="Search countries"
              />
              <Row>
                {metadata.data?.countries
                  .filter((c) =>
                    countrySearch
                      ? c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                        c.code.toLowerCase() === countrySearch.toLowerCase()
                      : c.code === selected?.country
                  )
                  .map((c) => (
                    <Button
                      key={c.code}
                      secondary
                      selected={c.code === selected?.country}
                      onPress={() => {
                        patch({ country: c.code, serviceIds: [] });
                        setChangeCountry(false);
                        setCountrySearch('');
                      }}
                    >
                      {c.name}
                    </Button>
                  ))}
              </Row>
            </>
          )}
          <Field
            label="Find usable services"
            value={serviceSearch}
            onChange={setServiceSearch}
            placeholder="Netflix, Prime Video, or any service…"
          />
          <Row>
            {metadata.data?.services
              .filter(
                (s) =>
                  selected?.serviceIds.includes(s.id) ||
                  (serviceSearch
                    ? s.name.toLowerCase().includes(serviceSearch.toLowerCase())
                    : quick.includes(s.id))
              )
              .map((s) => (
                <Button
                  key={s.id}
                  label={`${s.name} (service ${s.id})`}
                  secondary
                  selected={selected?.serviceIds.includes(s.id)}
                  disabled={!selected?.country}
                  onPress={() =>
                    patch({
                      serviceIds: selected!.serviceIds.includes(s.id)
                        ? selected!.serviceIds.filter((id) => id !== s.id)
                        : [...selected!.serviceIds, s.id],
                    })
                  }
                >
                  {s.name}
                </Button>
              ))}
          </Row>
          <GText color={glow.muted} size={14}>
            Confirm the country and services you can actually use. Subscriptions aren’t assumed.
          </GText>
          {own.member.prefill?.serviceIds.length ? (
            <Pill
              label="Review GoodWatch services"
              onPress={() => patch({ serviceIds: own.member.prefill!.serviceIds })}
            >
              Use my saved services
            </Pill>
          ) : null}
          {unsupportedContinuation && (
            <>
              <GText color={glow.muted} size={14}>
                This room includes continuing shows, which needs linked GoodWatch saved progress.
                You can switch to movies and new shows.
              </GText>
              <Pill
                label="Use movies and new shows"
                onPress={() =>
                  setConstraints((current) => ({ ...current, kinds: ['movie', 'show_start'] }))
                }
              >
                Use movies and new shows
              </Pill>
            </>
          )}
          <Pill
            label="Optional screens and filters"
            icon="settings"
            onPress={() => setAdvanced((v) => !v)}
          >
            More settings
          </Pill>
          {advanced && (
            <>
              <Row>
                {screens.map((s) => (
                  <Button
                    key={s.id}
                    secondary
                    selected={s.id === selectedId}
                    onPress={() => setSelectedId(s.id)}
                  >
                    {s.label}
                  </Button>
                ))}
                <Button
                  secondary
                  onPress={() => {
                    const id = Crypto.randomUUID();
                    setScreens((old) => [
                      ...old,
                      {
                        id,
                        label: 'Remote screen',
                        country: null,
                        serviceIds: [],
                        confirmed: false,
                      },
                    ]);
                    setSelectedId(id);
                    setChangeCountry(true);
                  }}
                >
                  Add remote screen
                </Button>
              </Row>
              <Field
                label="Screen name"
                value={selected?.label ?? ''}
                onChange={(label) => patch({ label })}
              />
              <GText color={glow.muted} size={14}>
                One screen per playback location. People on the same couch share a screen.
              </GText>
              <Row>
                {(
                  [
                    'movie',
                    'show_start',
                    ...(canContinue ? (['show_continue'] as const) : []),
                  ] as const
                ).map((kind) => (
                  <Button
                    key={kind}
                    secondary
                    selected={constraints.kinds.includes(kind)}
                    onPress={() =>
                      setConstraints((c) => ({
                        ...c,
                        kinds: c.kinds.includes(kind)
                          ? c.kinds.filter((k) => k !== kind)
                          : [...c.kinds, kind],
                      }))
                    }
                  >
                    {kind === 'movie'
                      ? 'Movies'
                      : kind === 'show_start'
                        ? 'New shows'
                        : 'Continue my shows'}
                  </Button>
                ))}
              </Row>
              <Field
                label="Time available (optional minutes)"
                value={minutes}
                onChange={setMinutes}
                numeric
              />
              <Row>
                {metadata.data?.moods.map((m) => (
                  <Button
                    key={m.id}
                    secondary
                    selected={constraints.moods.includes(m.id)}
                    onPress={() =>
                      setConstraints((c) => ({
                        ...c,
                        moods: c.moods.includes(m.id)
                          ? c.moods.filter((id) => id !== m.id)
                          : [...c.moods, m.id].slice(-3),
                      }))
                    }
                  >
                    {m.label}
                  </Button>
                ))}
              </Row>
              <GText color={glow.muted} size={14}>
                {guestOnly ? 'Continuing shows is not included in this guest beta.' : 'Continuing shows uses saved GoodWatch progress after sign-in. No history is entered manually.'}
              </GText>
            </>
          )}
          {metadata.isPending && <Words>Loading catalog choices…</Words>}
          {metadata.error && (
            <>
              <Notice error>Catalog choices could not load.</Notice>
              <Button secondary onPress={() => void metadata.refetch()}>
                Retry catalog
              </Button>
            </>
          )}
          <Pill
            label="Use these services"
            gold
            disabled={disabled || !valid || metadata.isFetching}
            onPress={() => void save()}
          >
            Use these services
          </Pill>
        </Drawer>
      )}
    </View>
  );
}
