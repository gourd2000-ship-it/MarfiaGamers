import { useState, type FormEvent } from 'react';

export interface JoinRoomValues {
  roomId: string;
  inviteToken: string;
  nickname: string;
}

export function JoinRoomForm({
  roomCode,
  inviteToken,
  onJoin
}: {
  roomCode: string;
  inviteToken: string;
  onJoin: (values: JoinRoomValues) => void;
}) {
  const [nickname, setNickname] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoin({ roomId: roomCode, inviteToken, nickname });
  }

  return (
    <form onSubmit={submit}>
      <h2>방 입장</h2>
      <p>방 코드: {roomCode}</p>
      <label>
        내 별명
        <input maxLength={12} onChange={(event) => setNickname(event.target.value)} required value={nickname} />
      </label>
      <button type="submit">방 입장</button>
    </form>
  );
}
