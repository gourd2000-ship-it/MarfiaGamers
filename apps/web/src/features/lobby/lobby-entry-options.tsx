import { CreateRoomForm, type CreateRoomValues } from './create-room-form.js';
import { JoinRoomForm, type JoinRoomValues } from './join-room-form.js';

export function LobbyEntryOptions({
  onCreate,
  onJoin
}: {
  onCreate: (values: CreateRoomValues) => void;
  onJoin: (values: JoinRoomValues) => void;
}) {
  return (
    <div className="lobby-entry-options">
      <JoinRoomForm onJoin={onJoin} />
      <CreateRoomForm onCreate={onCreate} />
    </div>
  );
}
