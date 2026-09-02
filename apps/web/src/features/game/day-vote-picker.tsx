import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

export function DayVotePicker({
  players,
  onVote
}: {
  players: readonly PublicGamePlayer[];
  onVote: (targetPlayerId: string) => void;
}) {
  return (
    <section aria-labelledby="day-vote-heading">
      <h2 id="day-vote-heading">비공개 투표</h2>
      <p>한 명을 선택해 투표하세요. 개인 선택은 다른 참가자에게 공개되지 않습니다.</p>
      {players.filter((player) => player.status === 'alive').map((player) => (
        <button key={player.id} onClick={() => onVote(player.id)} type="button">
          {player.nickname}에게 투표
        </button>
      ))}
    </section>
  );
}
