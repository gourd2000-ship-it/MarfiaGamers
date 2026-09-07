import type { PublicGamePlayer } from '@marfia/contracts/socket-events';
import { useState } from 'react';

export function MafiaTargetPicker({
  players,
  excludedPlayerIds,
  onSelect
}: {
  players: readonly PublicGamePlayer[];
  excludedPlayerIds: readonly string[];
  onSelect: (targetPlayerId: string) => boolean | Promise<boolean>;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function submitTarget() {
    if (!selectedPlayerId) return;
    setIsSubmitting(true);
    try {
      if (await onSelect(selectedPlayerId)) {
        setIsSubmitted(true);
      } else {
        setSelectedPlayerId(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="mafia-target-heading" className="action-picker">
      <h2 id="mafia-target-heading">마피아는 살해할 시민을 고르세요.</h2>
      <div className="selection-grid">
        {players.filter((player) => player.status === 'alive' && !excludedPlayerIds.includes(player.id)).map((player) => (
          <button aria-pressed={selectedPlayerId === player.id} className="player-choice" disabled={isSubmitting || isSubmitted} key={player.id} onClick={() => setSelectedPlayerId(player.id)} type="button">
            {player.nickname} 선택{selectedPlayerId === player.id ? <span aria-hidden="true" className="selection-confirmed">선택됨</span> : null}
          </button>
        ))}
      </div>
      <button className="button-primary" disabled={!selectedPlayerId || isSubmitting || isSubmitted} onClick={() => void submitTarget()} type="button">
        선택 완료
      </button>
    </section>
  );
}
