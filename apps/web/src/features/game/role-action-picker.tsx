import type { PublicGamePlayer } from '@marfia/contracts/socket-events';

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
  onSelect: (targetPlayerId: string) => void;
}) {
  return (
    <section aria-labelledby="role-action-heading">
      <h2 id="role-action-heading">{heading}</h2>
      <p>{description}</p>
      {players.filter((player) => player.status === 'alive').map((player) => (
        <button key={player.id} onClick={() => onSelect(player.id)} type="button">
          {player.nickname} {actionLabel}
        </button>
      ))}
    </section>
  );
}
