import { useEffect, useRef, useState } from 'react';
import { Animated, Image, View } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { Drawer } from './Drawer';
import { GText, Icon, Pill, Press, glow, native, type IconName } from './theme';
import { peerColor, type GlowPerson } from './model';
import {
  bestDecisionItem,
  decisionGrid,
  lensFact,
  titleYear,
  orderedDecisionItems,
  type DecisionItem,
  type DecisionLens,
} from './decision-model';

/** View model deliberately has aggregate agreement only; no peer choices or approvals. */
export interface DecisionProposal {
  candidateId: string;
  version: number;
  count: number;
  ownAgreed: boolean;
  isOwn: boolean;
  previousTitle: string | null;
}
export interface InspectionCue {
  participantId: string;
  key: string;
  kind: 'poster' | 'lens' | 'dice';
  candidateId?: string;
}
const lenses: { key: DecisionLens; label: string; caption: string; icon: IconName }[] = [
  { key: 'score', label: 'Top score', caption: 'GoodWatch score on every poster', icon: 'star' },
  {
    key: 'runtime',
    label: 'Shortest',
    caption: 'Movie runtime · shows per episode, not ranked against movies',
    icon: 'clock',
  },
  {
    key: 'quick',
    label: 'Quickest',
    caption: 'Average active time the whole room took to say Yep',
    icon: 'check',
  },
];
export function useDecisionPulse(key: string | number) {
  const reduced = useReducedMotion();
  const previous = useRef(key);
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (previous.current !== key && !reduced) {
      value.setValue(1);
      Animated.timing(value, { toValue: 0, duration: 750, useNativeDriver: native }).start();
    }
    previous.current = key;
  }, [key, reduced, value]);
  return value;
}
export function DecisionRoom({
  items,
  proposal,
  total,
  matchCount,
  checking,
  unavailable,
  disabled,
  wide,
  focus,
  setFocus,
  keepVoting,
  propose,
  agree,
  withdraw,
  retry,
  inspect,
  cues,
  people,
}: {
  items: DecisionItem[];
  proposal: DecisionProposal | null;
  total: number;
  matchCount: number;
  checking: boolean;
  unavailable: boolean;
  disabled: boolean;
  wide: boolean;
  focus: string | null;
  setFocus: (id: string | null) => void;
  keepVoting: () => void;
  propose: (id: string) => void;
  agree: () => void;
  withdraw: () => void;
  retry: () => void;
  inspect: (kind: InspectionCue['kind'], candidateId?: string) => void;
  cues: InspectionCue[];
  people: GlowPerson[];
}) {
  const reduced = useReducedMotion();
  const [lens, setLens] = useState<DecisionLens>('score');
  const [area, setArea] = useState({ width: 340, height: 250 });
  const [detail, setDetail] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const validIds = items.map((i) => i.title.id).join('|');
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    // A roster/answer change cancels a pending dice settlement rather than resurrecting a lost match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRolling(false);
    setLit(null);
  }, [validIds]);
  const best = bestDecisionItem(items, lens);
  const suggested = items.find((i) => i.title.id === bestDecisionItem(items, 'score')) ?? items[0];
  const proposed = items.find((i) => i.title.id === proposal?.candidateId);
  const selected = items.find((i) => i.title.id === focus && i.title.id !== proposal?.candidateId);
  const selection = selected ?? (!proposed ? suggested : undefined);
  const detailed = items.find((i) => i.title.id === detail);
  const gap = wide ? 16 : 8;
  const grid = decisionGrid(
    items.length,
    area.width - (wide ? 48 : 20),
    area.height - 16,
    gap,
    wide ? 220 : 170
  );
  const proposalPulse = useDecisionPulse(proposal?.version ?? 0);
  const [countSeen, setCountSeen] = useState({
    version: proposal?.version,
    count: proposal?.count ?? 0,
    bump: 0,
  });
  if (countSeen.version !== proposal?.version || countSeen.count !== (proposal?.count ?? 0)) {
    setCountSeen({
      version: proposal?.version,
      count: proposal?.count ?? 0,
      bump:
        countSeen.version === proposal?.version && (proposal?.count ?? 0) > countSeen.count
          ? countSeen.bump + 1
          : countSeen.bump,
    });
  }
  const countPulse = useDecisionPulse(countSeen.bump);
  function look(id: string) {
    setFocus(id === proposal?.candidateId ? null : id);
    inspect('poster', id);
  }
  function roll() {
    if (rolling || items.length < 2) return;
    inspect('dice');
    const pool = items.filter((i) => i.title.id !== (focus ?? proposal?.candidateId));
    const target = pool[Math.floor(Math.random() * pool.length)] ?? items[0];
    if (reduced) {
      setFocus(target.title.id);
      return;
    }
    setRolling(true);
    const steps = 10;
    let time = 0;
    let previous = '';
    for (let step = 0; step < steps; step++) {
      time += 65 + step * step * 3;
      const choices = items.filter((i) => i.title.id !== previous);
      const id =
        step === steps - 1
          ? target.title.id
          : choices[Math.floor(Math.random() * choices.length)].title.id;
      previous = id;
      timers.current.push(setTimeout(() => setLit(id), time));
    }
    timers.current.push(
      setTimeout(() => {
        setLit(null);
        setRolling(false);
        setFocus(target.title.id);
      }, time + 220)
    );
  }
  const peerDots = (kind: InspectionCue['kind'], id?: string) => (
    <View
      pointerEvents="none"
      style={{ flexDirection: 'row', position: 'absolute', top: -5, left: 2 }}
    >
      {cues
        .filter((c) => c.kind === kind && (kind !== 'poster' || c.candidateId === id))
        .slice(0, 4)
        .map((c) => (
          <InspectionDot
            key={c.key}
            cue={c}
            person={people.find((p) => p.id === c.participantId)}
          />
        ))}
    </View>
  );
  const agreement =
    proposed && proposal ? (
      <Animated.View
        style={{
          transform: [
            { scale: countPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
          ],
        }}
      >
        <Press
          label={`${proposal.ownAgreed ? 'You agree to' : 'Agree to'} ${titleYear(proposed.title)}. ${proposal.count} of ${total} agree`}
          disabled={disabled || checking}
          onPress={() => {
            if (!proposal.ownAgreed) agree();
          }}
          style={{
            minHeight: 48,
            borderRadius: 16,
            paddingHorizontal: 12,
            flexDirection: 'row',
            gap: 8,
            backgroundColor: proposal.ownAgreed || checking ? '#fbbf2414' : glow.amber,
            borderColor: glow.amber,
            borderWidth: 1,
          }}
        >
          <Icon
            name="check"
            size={18}
            color={proposal.ownAgreed || checking ? glow.amber : '#201400'}
          />
          <GText
            bold
            size={15}
            color={proposal.ownAgreed || checking ? glow.amber : '#201400'}
            lines={1}
          >
            {checking ? 'Everyone agrees' : proposal.ownAgreed ? 'You agree' : 'Agree'}
          </GText>
          <View
            accessible={false}
            style={{
              flexDirection: 'row',
              gap: 4,
              maxWidth: 100,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {Array.from({ length: Math.min(total, 16) }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  borderColor: proposal.ownAgreed || checking ? glow.amber : '#201400',
                  borderWidth: 1,
                  backgroundColor:
                    i < proposal.count
                      ? proposal.ownAgreed || checking
                        ? glow.amber
                        : '#201400'
                      : 'transparent',
                }}
              />
            ))}
          </View>
          <GText bold size={13} color={proposal.ownAgreed || checking ? glow.amber : '#201400'}>
            {proposal.count}/{total}
          </GText>
        </Press>
        {proposal.ownAgreed && !checking && (
          <Press
            label="Take back your agreement"
            onPress={withdraw}
            disabled={disabled}
            style={{ minHeight: 24 }}
          >
            <GText size={12} color={glow.muted}>
              Take back
            </GText>
          </Press>
        )}
        {countSeen.bump > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 16,
              top: -12,
              opacity: countPulse,
              transform: [
                {
                  translateY: countPulse.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
                },
              ],
            }}
          >
            <GText bold size={18} color={glow.amber}>
              +1
            </GText>
          </Animated.View>
        )}
      </Animated.View>
    ) : null;
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          height: 48,
          flexDirection: 'row',
          paddingHorizontal: wide ? 40 : 12,
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pill
          label="Keep voting"
          onPress={keepVoting}
          icon="left"
          style={{ minHeight: 40, paddingHorizontal: 12 }}
        >
          <GText size={14} bold>
            Keep voting
          </GText>
        </Pill>
        <GText bold size={wide ? 20 : 16} lines={1}>
          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
        </GText>
        {wide && (
          <GText color={glow.muted} size={14}>
            · decide together
          </GText>
        )}
      </View>
      <View style={{ height: 64, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {lenses.map((l) => (
            <View key={l.key}>
              <Press
                label={`${l.label}: ${l.caption}`}
                selected={lens === l.key}
                onPress={() => {
                  setLens(l.key);
                  inspect('lens');
                }}
                style={{
                  flexDirection: 'row',
                  minHeight: 36,
                  gap: 5,
                  borderRadius: 18,
                  paddingHorizontal: wide ? 13 : 9,
                  borderWidth: 1,
                  borderColor: lens === l.key ? glow.amber : glow.line,
                  backgroundColor: lens === l.key ? '#fbbf2420' : '#111111bb',
                }}
              >
                <Icon name={l.icon} size={14} color={lens === l.key ? glow.amber : glow.soft} />
                <GText bold size={13} color={lens === l.key ? glow.amber : glow.soft}>
                  {l.label}
                </GText>
              </Press>
            </View>
          ))}
          <View>
            <Press
              label="Surprise me: inspect a random match, without proposing or agreeing"
              onPress={roll}
              disabled={rolling || items.length < 2}
              style={{
                width: 40,
                minWidth: 40,
                minHeight: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: rolling ? glow.amber : glow.line,
                backgroundColor: '#111111bb',
              }}
            >
              <Icon name="dice" size={21} color={rolling ? glow.amber : glow.soft} />
            </Press>
            {peerDots('dice')}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <GText size={11} color={glow.muted} lines={1}>
            {lenses.find((l) => l.key === lens)?.caption}
          </GText>
          <View style={{ width: 20 }}>{peerDots('lens')}</View>
        </View>
      </View>
      <View
        onLayout={(e) =>
          setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
        }
        style={{ flex: 1, minHeight: 20, alignItems: 'center', justifyContent: 'center' }}
      >
        {items.length ? (
          <View
            style={{
              width: grid.columns * grid.width + (grid.columns - 1) * gap,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap,
              justifyContent: 'center',
            }}
          >
            {orderedDecisionItems(items, lens).map((item) => (
              <DecisionTile
                key={item.title.id}
                item={item}
                width={grid.width}
                height={grid.height}
                lens={lens}
                proposed={proposal?.candidateId === item.title.id}
                selected={focus === item.title.id}
                best={best === item.title.id}
                lit={lit === item.title.id}
                proposalVersion={proposal?.candidateId === item.title.id ? proposal.version : 0}
                dots={peerDots('poster', item.title.id)}
                onPress={() => {
                  if (!rolling) {
                    if (item.title.id === (focus ?? proposal?.candidateId))
                      setDetail(item.title.id);
                    else look(item.title.id);
                  }
                }}
              />
            ))}
          </View>
        ) : (
          <View style={{ padding: 20, gap: 8 }}>
            <GText bold size={22}>
              Your matches changed
            </GText>
            <GText color={glow.muted} size={14}>
              Keep voting to discover more with everyone in the room.
            </GText>
          </View>
        )}
      </View>
      <Animated.View
        style={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: 1040,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderRadius: wide ? 28 : undefined,
          marginBottom: wide ? 18 : 0,
          borderWidth: 1,
          borderColor: proposal ? '#fbbf2470' : glow.line,
          backgroundColor: '#101010f5',
          padding: wide ? 18 : 12,
          gap: 8,
          transform: [
            { translateY: proposalPulse.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
          ],
        }}
      >
        <View
          style={{
            flexDirection: wide ? 'row' : 'column',
            gap: wide ? 24 : 8,
            alignItems: wide ? 'center' : undefined,
          }}
        >
          {selection ? (
            <View style={{ flex: wide ? 1 : undefined, gap: 7 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Press
                  label={`Details for ${titleYear(selection.title)}`}
                  onPress={() => setDetail(selection.title.id)}
                  style={{ minWidth: 34 }}
                >
                  <MiniPoster item={selection} />
                </Press>
                <View style={{ flex: 1, gap: 2 }}>
                  <GText size={10} bold color={selected ? glow.soft : glow.amber} lines={1}>
                    {selected
                      ? 'YOU’RE LOOKING AT'
                      : selection.title.score === null
                        ? 'SUGGESTED'
                        : 'SUGGESTED · HIGHEST GOODWATCH SCORE'}
                  </GText>
                  <GText bold size={wide ? 19 : 16} lines={1}>
                    {titleYear(selection.title)}
                  </GText>
                  <GText size={11} color={glow.muted} lines={1}>
                    {proposal
                      ? `Replaces the proposal · clears ${proposal.count} agreements`
                      : 'Proposing counts as your Agree.'}
                  </GText>
                </View>
                {selected && (
                  <Press
                    label="Stop looking"
                    onPress={() => setFocus(null)}
                    style={{ minWidth: 32, minHeight: 32 }}
                  >
                    <Icon name="close" size={17} />
                  </Press>
                )}
              </View>
              <Pill
                label={`Propose ${titleYear(selection.title)}${proposal ? ' instead' : ''}`}
                onPress={() => propose(selection.title.id)}
                gold
                disabled={disabled || checking}
                icon="tickets"
                style={{ borderRadius: 16, minHeight: 44 }}
              >
                {proposal ? 'Propose this instead' : 'Propose this'}
              </Pill>
            </View>
          ) : !wide && !proposed ? null : (
            wide && (
              <View style={{ flex: 1 }}>
                <GText bold>Tap any poster to compare</GText>
                <GText color={glow.muted} size={13}>
                  Browsing doesn’t propose or agree.
                </GText>
              </View>
            )
          )}
          {proposed && (
            <View style={{ flex: wide ? 1.1 : undefined, gap: 7 }}>
              <Press
                label={`Details for proposed ${titleYear(proposed.title)}`}
                onPress={() => setDetail(proposed.title.id)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-start',
                  gap: 10,
                  minHeight: selection && !wide ? 28 : 50,
                }}
              >
                {(!selection || wide) && <MiniPoster item={proposed} />}
                <View style={{ flex: 1 }}>
                  <GText size={10} bold color={glow.amber}>
                    {proposal?.isOwn
                      ? 'YOUR PROPOSAL'
                      : proposal?.previousTitle
                        ? 'PROPOSAL CHANGED'
                        : 'PROPOSED'}
                  </GText>
                  <GText size={wide ? 19 : 16} bold lines={1}>
                    {titleYear(proposed.title)}
                  </GText>
                  {proposal?.previousTitle && !selection && (
                    <GText size={11} lines={1} color={glow.muted}>
                      Was {proposal.previousTitle}
                    </GText>
                  )}
                </View>
              </Press>
              {agreement}
            </View>
          )}
          {!proposed && wide && (
            <View style={{ flex: 1 }}>
              <GText bold>Nothing proposed yet</GText>
              <GText size={13} color={glow.muted}>
                Anyone can propose. Everyone else taps Agree.
              </GText>
            </View>
          )}
        </View>
        {proposal && matchCount < items.length && (
          <GText size={11} color={glow.muted}>
            Someone joined. The proposal stays; everyone still needs to agree.
          </GText>
        )}
        {checking && (
          <GText size={12} color={glow.amber}>
            Checking availability for everyone…
          </GText>
        )}
        {unavailable && (
          <Press
            label="Retry availability check"
            onPress={retry}
            disabled={disabled}
            style={{ minHeight: 32 }}
          >
            <GText color={glow.amber} size={13}>
              Availability needs another check · Retry
            </GText>
          </Press>
        )}
      </Animated.View>
      {detailed && (
        <Drawer title={titleYear(detailed.title)} close={() => setDetail(null)}>
          <GText color={glow.muted}>
            {[
              detailed.title.kind === 'movie'
                ? 'Movie'
                : (detailed.title.episodeLabel ?? 'Episode'),
              lensFact(detailed, 'runtime'),
              detailed.title.genres.join(' · '),
            ]
              .filter(Boolean)
              .join(' · ')}
          </GText>
          <GText>{detailed.title.overview ?? 'No synopsis is available.'}</GText>
          <GText size={13} color={glow.muted}>
            Inspecting does not propose or agree.
          </GText>
        </Drawer>
      )}
    </View>
  );
}
function MiniPoster({ item }: { item: DecisionItem }) {
  return item.title.posterUrl ? (
    <Image
      source={{ uri: item.title.posterUrl }}
      style={{ width: 34, height: 51, borderRadius: 5 }}
    />
  ) : (
    <View
      style={{
        width: 34,
        height: 51,
        borderRadius: 5,
        backgroundColor: '#303030',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="tickets" size={16} />
    </View>
  );
}
function DecisionTile({
  item,
  width,
  height,
  lens,
  proposed,
  selected,
  best,
  lit,
  proposalVersion,
  dots,
  onPress,
}: {
  item: DecisionItem;
  width: number;
  height: number;
  lens: DecisionLens;
  proposed: boolean;
  selected: boolean;
  best: boolean;
  lit: boolean;
  proposalVersion: number;
  dots: React.ReactNode;
  onPress: () => void;
}) {
  const pulse = useDecisionPulse(proposalVersion);
  const tiny = width < 82;
  return (
    <Press
      label={`Inspect ${titleYear(item.title)}, ${lensFact(item, lens)}${proposed ? ', proposed' : ''}${best ? ', best' : ''}`}
      onPress={onPress}
      style={{ width, minWidth: 0, height, minHeight: 0 }}
    >
      <Animated.View
        style={{
          width,
          height,
          borderRadius: Math.max(5, Math.min(16, width * 0.08)),
          overflow: 'hidden',
          borderWidth: proposed ? 3 : selected || lit ? 2 : 1,
          borderColor: proposed ? glow.amber : selected || lit ? '#fff' : glow.line,
          backgroundColor: '#222',
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        }}
      >
        {item.title.posterUrl ? (
          <Image
            accessible={false}
            source={{ uri: item.title.posterUrl }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', padding: 5 }}>
            <GText size={tiny ? 10 : 15} bold lines={3}>
              {titleYear(item.title)}
            </GText>
          </View>
        )}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            paddingHorizontal: tiny ? 3 : 6,
            paddingVertical: 2,
            borderRadius: 8,
            backgroundColor: best ? glow.amber : '#000d',
          }}
        >
          <GText size={tiny ? 9 : 12} bold color={best ? '#201400' : glow.ink} lines={1}>
            {lensFact(item, lens, tiny)}
          </GText>
        </View>
        {proposed && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingVertical: 5,
              backgroundColor: '#000b',
              alignItems: 'center',
            }}
          >
            <GText size={tiny ? 8 : 11} bold color={glow.amber}>
              PROPOSED
            </GText>
          </View>
        )}
        {lit && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: '#ffffff40',
            }}
          />
        )}
      </Animated.View>
      {dots}
    </Press>
  );
}
function InspectionDot({ cue, person }: { cue: InspectionCue; person?: GlowPerson }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    scale.setValue(0.6);
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 130,
      useNativeDriver: native,
    }).start();
  }, [cue.key, reduced, scale]);
  return (
    <Animated.View
      accessibilityLabel={`${person?.nickname ?? 'A participant'} is inspecting`}
      style={{
        width: 17,
        height: 17,
        borderRadius: 9,
        backgroundColor: '#111',
        borderWidth: 1.5,
        borderColor: peerColor(cue.participantId),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: -3,
        transform: [{ scale }],
      }}
    >
      <GText bold size={9} color={peerColor(cue.participantId)}>
        {(person?.nickname ?? '?').slice(0, 1)}
      </GText>
    </Animated.View>
  );
}
