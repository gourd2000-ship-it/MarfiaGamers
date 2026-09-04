import type { PublicGamePlayer } from '@marfia/contracts/socket-events';
import { useState } from 'react';

export function DayVotePicker({
  players,
  onVote
}: {
  players: readonly PublicGamePlayer[];
  onVote: (targetPlayerId: string) => boolean | Promise<boolean>;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitVote(targetPlayerId: string) {
    setIsSubmitting(true);
    try {
      if (await onVote(targetPlayerId)) {
        setSelectedPlayerId(targetPlayerId);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="day-vote-heading" className="action-picker">
      <h2 id="day-vote-heading">비공개 투표</h2>
      <p>한 명을 선택해 투표하세요. 개인 선택은 다른 참가자에게 공개되지 않습니다.</p>
      <div className="selection-grid">
        {players.filter((player) => player.status === 'alive').map((player) => (
          <button aria-pressed={selectedPlayerId === player.id} className="player-choice" disabled={isSubmitting} key={player.id} onClick={() => void submitVote(player.id)} type="button">
            {player.nickname}에게 투표{selectedPlayerId === player.id ? <span aria-hidden="true" className="selection-confirmed">선택됨</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
