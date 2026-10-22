import type { RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts';
import { Button, Heading, Notice, Words } from '../components/ui';

/** Explicit recovery for pre-policy rounds. Never rewrites history or changes kinds automatically. */
export function LegacyRound({ snapshot, disabled, send }: { snapshot: RoomSnapshot; disabled: boolean; send: (command: RoomCommand) => void }) {
  return <>
    <Heading>This round needs saved progress</Heading>
    <Notice>Continuing shows requires GoodWatch sign-in using saved progress. Sign-in is not connected yet, so this older round cannot continue.</Notice>
    {snapshot.own.canHost ? <>
      <Words muted>Returning to setup clears this round’s votes. Then choose movies and shows to start.</Words>
      <Button disabled={disabled} onPress={() => send({ type: 'new_round', expectedRevision: snapshot.shared.revision })}>Return to setup</Button>
    </> : <Words muted>Ask the host to return to setup and choose movies and shows to start.</Words>}
  </>;
}
