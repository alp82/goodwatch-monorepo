import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EpisodeIdentity, ProgressConflictReason, RoomCommand, RoomSnapshot, ShowProgressInput } from '@goodwatch/yepwatch-contracts';
import { api } from '../core/api';
import type { RoomAccess } from '../core/credentials';
import { Button, Field, Notice, Panel, Row, Words } from '../components/ui';

export function episodeLabel(e: EpisodeIdentity) { return `Season ${e.displaySeason ?? e.season}, episode ${e.displayNumber ?? e.number}`; }
const conflictLabels: Record<ProgressConflictReason, string> = {
  missing_progress: 'Your progress is needed before continuing this show.', different_next_episode: 'This group needs to agree on an episode. Nobody’s progress will be shared.', rewind_or_spoiler_approval: 'This episode may involve a rewind or spoilers. Your explicit agreement is needed.', episode_unavailable: 'An episode has no confirmed availability for every screen.', episode_catalog_unavailable: 'The episode catalog is unavailable. Continuing this show is blocked until it can be checked.',
};
export function ProgressEditor({ snapshot, access, disabled, send }: { snapshot: RoomSnapshot; access: RoomAccess; disabled: boolean; send: (c: RoomCommand) => void }) {
  const [query, setQuery] = useState(''); const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<{ id: number; title: string }>(); const [filter, setFilter] = useState('');
  const [input, setInput] = useState<ShowProgressInput>(); const [approval, setApproval] = useState<number | null>();
  const search = useQuery({ queryKey: ['shows', access.roomId, submitted], queryFn: () => api.shows(access, submitted), enabled: submitted.trim().length >= 2 });
  const progress = useQuery({ queryKey: ['show-progress', access.roomId, selected?.id, snapshot.own.nextSequence], queryFn: () => api.progress(access, selected!.id), enabled: Boolean(selected) });
  const state = input ?? progress.data?.own.input ?? { state: 'unknown' };
  const accepted = approval === undefined ? progress.data?.own.approvedEpisodeId ?? null : approval;
  const conflicts = progress.data?.conflicts ?? snapshot.own.progressConflicts.filter(c => c.showId === selected?.id);
  function select(id: number, title: string) { setSelected({ id, title }); setFilter(''); setInput(undefined); setApproval(undefined); }
  const publicProposal = snapshot.shared.episodeProposals?.find(p => p.showId === selected?.id);
  const knownIds = Array.from(new Set([...snapshot.own.progress.map(p => p.showId), ...snapshot.own.progressConflicts.map(p => p.showId), ...(snapshot.shared.episodeProposals ?? []).map(p => p.showId)]));
  return <Panel><Words style={{ fontFamily: 'GabaritoBold' }}>Your show progress · private</Words><Words muted>Tell us what you would watch next. This changes this room only, never your viewing history.</Words>
    <Field label="Find a show to continue" value={query} onChange={setQuery} placeholder="Search by show title" /><Button secondary disabled={disabled || query.trim().length < 2} onPress={() => setSubmitted(query.trim())}>Find show</Button>
    {search.isFetching && <Words muted>Finding shows…</Words>}{search.error && <Notice error>Show search is unavailable. No titles or progress have been invented.</Notice>}
    {search.data?.shows.map(show => <Button key={show.tmdbId} secondary selected={selected?.id === show.tmdbId} onPress={() => select(show.tmdbId, `${show.title}${show.year ? ` (${show.year})` : ''}`)}>{show.title}{show.year ? ` (${show.year})` : ''}</Button>)}
    {search.data?.shows.length === 0 && <Words muted>No shows found for that title.</Words>}
    <Row>{knownIds.map(id => { const title = snapshot.shared.candidates.find(c => c.identity.tmdbId === id && c.identity.kind !== 'movie')?.title ?? 'Review a saved show'; return <Button key={id} secondary onPress={() => select(id, title)}>{title}</Button>; })}</Row>
    {snapshot.own.progressConflicts.length > 0 && !selected && <Notice>Some show progress needs your review. Select a saved show above; other people’s episode history stays private.</Notice>}
    {selected && <><Words style={{ fontFamily: 'GabaritoBold' }}>{selected.title}</Words>
      {publicProposal && <Notice>Group proposal: {episodeLabel(publicProposal.episode)}. Your progress stays private; accepting the episode is a separate choice.</Notice>}
      {progress.isFetching && <Words muted>Loading catalog episodes…</Words>}
      {(progress.error || progress.data?.catalogState === 'unavailable') && <Notice error>Episode details are unavailable. We cannot safely choose an episode for you.</Notice>}
      {conflicts.map((c, i) => <Notice key={i}>{conflictLabels[c.reason]}</Notice>)}
      <Row><Button secondary selected={state.state === 'unknown'} onPress={() => { setInput({ state: 'unknown' }); setApproval(null); }}>I’m not sure</Button><Button secondary selected={state.state === 'not_started'} onPress={() => { setInput({ state: 'not_started' }); setApproval(null); }}>Not started</Button></Row>
      {progress.data?.catalogState === 'ready' && <><Field label="Find your next episode" value={filter} onChange={setFilter} placeholder="Season, episode, or episode name" /><Words muted>Select the next episode you want to watch, using the catalog’s episode labels.</Words>
      {progress.data.episodes.filter(e => filter ? `${episodeLabel(e)} ${e.name ?? ''}`.toLowerCase().includes(filter.toLowerCase()) : e.tmdbId === (state.state === 'continue' ? state.nextEpisodeId : null) || conflicts.some(c => c.proposedEpisode?.tmdbId === e.tmdbId)).map(e => <Button key={e.tmdbId} secondary selected={state.state === 'continue' && state.nextEpisodeId === e.tmdbId} onPress={() => { setInput({ state: 'continue', nextEpisodeId: e.tmdbId }); setApproval(null); }}>{episodeLabel(e)}{e.name ? ` · ${e.name}` : ''}</Button>)}
      </>}
      {snapshot.own.canHost && state.state === 'continue' && <><Words muted>The host can intentionally share an episode proposal. This action tells the group which episode is proposed, without sharing your viewing history.</Words><Button secondary disabled={disabled || progress.data?.catalogState !== 'ready'} onPress={() => send({ type: 'propose_episode', expectedContextVersion: snapshot.shared.contextVersion, showId: selected.id, episodeId: state.nextEpisodeId })}>Propose this episode to group</Button></>}
      {publicProposal && state.state !== 'unknown' && <Button secondary selected={accepted === publicProposal.episode.tmdbId} onPress={() => setApproval(accepted === publicProposal.episode.tmdbId ? null : publicProposal.episode.tmdbId)}>I accept the proposed episode for this group, including any rewind or spoilers</Button>}
      {conflicts.filter(c => c.proposedEpisode && ['different_next_episode', 'rewind_or_spoiler_approval'].includes(c.reason)).map((c, i) => <Button key={i} secondary selected={accepted === c.proposedEpisode!.tmdbId} onPress={() => setApproval(accepted === c.proposedEpisode!.tmdbId ? null : c.proposedEpisode!.tmdbId)}>I accept {episodeLabel(c.proposedEpisode!)} — including any rewind or spoilers</Button>)}
      <Button disabled={disabled || progress.data?.catalogState !== 'ready'} onPress={() => send({ type: 'show_progress', showId: selected.id, input: state, approvedEpisodeId: accepted })}>Save my room progress</Button>
    </>}
  </Panel>;
}
