export function GameResultPanel({ winner }: { winner: 'mafia' | 'citizens' }) {
  return (
    <section aria-labelledby="game-result-heading">
      <h2 id="game-result-heading">게임 결과</h2>
      <p role="status">{winner === 'mafia' ? '마피아 팀 승리' : '시민 팀 승리'}</p>
    </section>
  );
}
