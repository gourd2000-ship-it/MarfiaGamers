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

  async function submitTarget(targetPlayerId: string) {
    setIsSubmitting(true);
    try {
      if (await onSelect(targetPlayerId)) {
        setSelectedPlayerId(targetPlayerId);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="mafia-target-heading" className="action-picker">
      <h2 id="mafia-target-heading">제거할 대상을 선택하세요</h2>
      <div className="selection-grid">
        {players.filter((player) => player.status === 'alive' && !excludedPlayerIds.includes(player.id)).map((player) => (
          <button aria-pressed={selectedPlayerId === player.id} className="player-choice" disabled={isSubmitting} key={player.id} onClick={() => void submitTarget(player.id)} type="button">
            {player.nickname} 선택{selectedPlayerId === player.id ? <span aria-hidden="true" className="selection-confirmed">선택됨</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
