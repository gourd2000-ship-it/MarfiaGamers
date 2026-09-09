import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

export function DayEliminationNotice({
  players,
  result
}: {
  players: readonly PublicGamePlayer[];
  result: { playerId: string; alignment: 'mafia' | 'citizen' };
}) {
  const nickname = players.find((player) => player.id === result.playerId)?.nickname ?? '추방된 참가자';
  const alignment = result.alignment === 'mafia' ? '마피아' : '시민';

  return (
    <section aria-label="추방 결과" className="day-elimination-notice" role="status">
      <p><strong>{nickname}님이 추방되었습니다.</strong></p>
      <p>{nickname}님은 {alignment}입니다.</p>
    </section>
  );
}
