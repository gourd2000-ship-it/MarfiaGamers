import type { PublicRoomPlayer } from '@marfia/contracts/socket-events';

export function LobbyParticipantList({ players }: { players: readonly PublicRoomPlayer[] }) {
  const activePlayers = players.filter((player) => player.status === 'active');

  return (
    <section aria-labelledby="lobby-participant-list-heading" className="player-list-card">
      <h2 id="lobby-participant-list-heading">로비 참가자</h2>
      <ul className="player-grid">
        {activePlayers.map((player) => (
          <li aria-label={`${player.nickname}${player.isHost ? ' · 방장' : ''}`} className="player-card" key={player.id}>
            <span className="player-name">{player.nickname}</span>
            {player.isHost ? <span className="host-badge">방장</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
