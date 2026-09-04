import type { PublicGamePlayer } from '@marfia/contracts/socket-events';
import { useState } from 'react';

export function RoleActionPicker({
  heading,
  description,
  actionLabel,
  players,
  onSelect
}: {
  heading: string;
  description: string;
  actionLabel: string;
  players: readonly PublicGamePlayer[];
  onSelect: (targetPlayerId: string) => boolean | Promise<boolean>;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAction(targetPlayerId: string) {
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
    <section aria-labelledby="role-action-heading" className="action-picker">
      <h2 id="role-action-heading">{heading}</h2>
      <p>{description}</p>
      <div className="selection-grid">
        {players.filter((player) => player.status === 'alive').map((player) => (
          <button aria-pressed={selectedPlayerId === player.id} className="player-choice" disabled={isSubmitting} key={player.id} onClick={() => void submitAction(player.id)} type="button">
            {player.nickname} {actionLabel}{selectedPlayerId === player.id ? <span aria-hidden="true" className="selection-confirmed">선택됨</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
