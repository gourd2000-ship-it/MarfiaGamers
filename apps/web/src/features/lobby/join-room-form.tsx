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
    <form aria-labelledby="join-room-heading" className="lobby-card" onSubmit={submit}>
      <p className="eyebrow">초대받은 게임</p>
      <h2 id="join-room-heading">방 입장</h2>
      <p className="room-code">방 코드: <strong>{roomCode}</strong></p>
      <label className="form-field">
        <span>내 별명</span>
        <input className="form-input" maxLength={12} onChange={(event) => setNickname(event.target.value)} required value={nickname} />
      </label>
      <button className="button-primary" type="submit">방 입장</button>
    </form>
  );
}
