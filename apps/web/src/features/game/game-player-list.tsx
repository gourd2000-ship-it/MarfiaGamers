import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

const statusLabels: Record<PublicGamePlayer['status'], string> = {
  alive: '생존',
  dead: '탈락',
  resigned: '자동 기권'
};

export function GamePlayerList({ players }: { players: readonly PublicGamePlayer[] }) {
  return (
    <section aria-labelledby="game-player-list-heading" className="player-list-card">
      <h2 id="game-player-list-heading">참가자 현황</h2>
      <ul className="player-grid">
        {players.map((player) => (
          <li aria-label={`${player.nickname} · ${statusLabels[player.status]}${player.isHost ? ' · 방장' : ''}`} className="player-card" key={player.id}>
            <span className="player-name">{player.nickname}</span>
            <span className={`status-badge is-${player.status}`}>{statusLabels[player.status]}</span>
            {player.isHost ? <span className="host-badge">방장</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
