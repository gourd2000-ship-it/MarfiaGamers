import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

export function MafiaTargetPicker({
  players,
  excludedPlayerIds,
  onSelect
}: {
  players: readonly PublicGamePlayer[];
  excludedPlayerIds: readonly string[];
  onSelect: (targetPlayerId: string) => void;
}) {
  return (
    <section aria-labelledby="mafia-target-heading">
      <h2 id="mafia-target-heading">제거할 대상을 선택하세요</h2>
      {players.filter((player) => player.status === 'alive' && !excludedPlayerIds.includes(player.id)).map((player) => (
        <button key={player.id} onClick={() => onSelect(player.id)} type="button">
          {player.nickname} 선택
        </button>
      ))}
    </section>
  );
}
