import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

const statusLabels: Record<PublicGamePlayer['status'], string> = {
  alive: '생존',
  dead: '탈락',
  resigned: '자동 기권'
};

export function GamePlayerList({ players }: { players: readonly PublicGamePlayer[] }) {
  return (
    <section aria-labelledby="game-player-list-heading">
      <h2 id="game-player-list-heading">참가자 현황</h2>
      <ul>
        {players.map((player) => (
          <li key={player.id}>{player.nickname} · {statusLabels[player.status]}{player.isHost ? ' · 방장' : ''}</li>
        ))}
      </ul>
    </section>
  );
}
