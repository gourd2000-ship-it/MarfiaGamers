import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

export function NightResultNotice({
  players,
  result
}: {
  players: readonly PublicGamePlayer[];
  result: {
    mafiaTargetPlayerId: string | null;
    doctorTargetPlayerId: string | null;
    eliminatedPlayerId: string | null;
  };
}) {
  const mafiaTarget = playerName(players, result.mafiaTargetPlayerId);
  const doctorTarget = playerName(players, result.doctorTargetPlayerId);

  return (
    <section aria-labelledby="night-result-heading" className="night-result-notice" role="status">
      <h2 id="night-result-heading">밤 결과</h2>
      {mafiaTarget ? (
        <p>{result.eliminatedPlayerId ? `${mafiaTarget}님이 마피아에게 살해당했습니다.` : `${mafiaTarget}님이 마피아의 습격을 받았지만 살아남았습니다.`}</p>
      ) : <p>마피아의 습격으로 사망한 사람이 없습니다.</p>}
      {doctorTarget ? <p>의사는 {doctorTarget}님을 치료하였습니다.</p> : null}
    </section>
  );
}

function playerName(players: readonly PublicGamePlayer[], playerId: string | null): string | null {
  return playerId ? players.find((player) => player.id === playerId)?.nickname ?? null : null;
}
