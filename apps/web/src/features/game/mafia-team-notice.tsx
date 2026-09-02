import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

export function MafiaTeamNotice({
  players,
  mafiaPlayerIds
}: {
  players: readonly PublicGamePlayer[];
  mafiaPlayerIds: readonly string[];
}) {
  const teammates = players
    .filter((player) => mafiaPlayerIds.includes(player.id))
    .map((player) => player.nickname);

  return <p role="status">함께 행동하는 마피아: {teammates.join(', ')}</p>;
}
