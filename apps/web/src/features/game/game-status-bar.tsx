import type { GamePhase } from '@marfia/contracts/game-presets';
import { PhaseCountdown } from './phase-countdown.js';
import { PhaseStatus } from './phase-status.js';

export function GameStatusBar({
  phase,
  endsAt,
  onSkip,
  isSkipping = false
}: {
  phase: GamePhase;
  endsAt: string | null;
  onSkip?: () => void;
  isSkipping?: boolean;
}) {
  return (
    <section aria-label="현재 게임 상태" className="game-status-bar">
      <PhaseStatus phase={phase} />
      <PhaseCountdown endsAt={endsAt} />
      {onSkip ? <button className="button-secondary phase-skip" disabled={isSkipping} onClick={onSkip} type="button">시간 넘기기</button> : null}
    </section>
  );
}
