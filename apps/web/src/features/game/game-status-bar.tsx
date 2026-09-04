import type { GamePhase } from '@marfia/contracts/game-presets';
import { PhaseCountdown } from './phase-countdown.js';
import { PhaseStatus } from './phase-status.js';

export function GameStatusBar({ phase, endsAt }: { phase: GamePhase; endsAt: string | null }) {
  return (
    <section aria-label="현재 게임 상태" className="game-status-bar">
      <PhaseStatus phase={phase} />
      <PhaseCountdown endsAt={endsAt} />
    </section>
  );
}
