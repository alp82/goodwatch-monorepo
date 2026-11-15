/**
 * The next-day question (rethink-picks.md item 13): one card above the start page for the newest decided pick the
 * profile hasn't rated, "How was <title>?" with Loved it, Not for me and Didn't watch it. Same Taste card look and
 * exits; answers stay in YepWatch. The page decides whether it has this slot when it appears, so nothing shifts.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { tasteProfile, type FollowUp } from '../../core/continuous/taste-profile';
import { useLayout } from '../shell/layout';
import { followUpLabel } from './FollowUpCard.logic';
import { cardMeta, FOLLOW_UP_ANSWERS, type CardAnswer } from '../taste/answers';
import { CompactTasteCard } from '../taste/TasteCard';
import { LiveDeck, type DeckEntry, type DrawCard } from '../taste/TasteDeck';


export function FollowUpCard({ followUps }: { followUps: readonly FollowUp[] }) {
  const { max, z } = useLayout();
  const [now] = useState(() => Date.now());
  const [answered, setAnswered] = useState<DeckEntry[]>([]);
  const f = followUps[0] ?? null;
  const current = f ? { key: f.key, title: f.title, posterUrl: f.posterUrl, meta: cardMeta(f), overview: f.overview } : null;
  const draw: DrawCard = (t, o) => {
    const of = followUps.find((x) => x.key === t.key) ?? f;
    return <CompactTasteCard t={t} w={o.w} label={of ? followUpLabel(of.decidedAt, now) : 'Your pick'} question={`How was ${t.title}?`} answers={FOLLOW_UP_ANSWERS} onAnswer={o.onAnswer} disabled={o.disabled} />;
  };
  const answer = (a: CardAnswer) => {
    if (!f || !current || a === 'unseen') return;
    setAnswered((x) => [...x, { t: current, a }]);
    tasteProfile.answerFollowUp(f, a);
  };
  return (
    <View testID="follow-up" style={{ width: '100%', maxWidth: Math.min(max, z(640)), alignSelf: 'center' }}>
      <LiveDeck current={current} index={answered.length} answered={answered} onAnswer={answer} draw={draw} end={null}
        drag={{ right: 'loved', left: 'not_for_me', down: 'did_not_watch' }} />
    </View>
  );
}
