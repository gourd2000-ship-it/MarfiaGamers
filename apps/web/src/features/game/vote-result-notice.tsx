import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

export function VoteResultNotice({
  players,
  voteTotals
}: {
  players: readonly PublicGamePlayer[];
  voteTotals: Readonly<Record<string, number>>;
}) {
  const nicknameById = new Map(players.map((player) => [player.id, player.nickname]));
  const entries = Object.entries(voteTotals);

  return (
    <section aria-labelledby="vote-result-heading">
      <h2 id="vote-result-heading">투표 결과</h2>
      {entries.length === 0 ? (
        <p>득표가 없습니다.</p>
      ) : (
        <ul>
          {entries.map(([playerId, total]) => (
            <li key={playerId}>{nicknameById.get(playerId) ?? '알 수 없는 참가자'}: {total}표</li>
          ))}
        </ul>
      )}
    </section>
  );
}
