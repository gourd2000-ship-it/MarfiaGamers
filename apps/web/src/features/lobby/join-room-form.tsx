import { useState, type FormEvent } from 'react';

export interface JoinRoomValues {
  roomId: string;
  nickname: string;
}

export function JoinRoomForm({
  roomCode,
  onJoin
}: {
  roomCode?: string;
  onJoin: (values: JoinRoomValues) => void;
}) {
  const [enteredRoomCode, setEnteredRoomCode] = useState(roomCode ?? '');
  const [nickname, setNickname] = useState('');
  const isFixedRoomCode = Boolean(roomCode);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoin({ roomId: enteredRoomCode, nickname });
  }

  return (
    <form aria-labelledby="join-room-heading" className="lobby-card" onSubmit={submit}>
      <p className="eyebrow">참여할 게임</p>
      <h2 id="join-room-heading">방 입장</h2>
      {isFixedRoomCode ? (
        <p className="room-code">방 코드: <strong>{roomCode}</strong></p>
      ) : (
        <label className="form-field">
          <span>방 코드</span>
          <input
            className="form-input"
            inputMode="numeric"
            maxLength={6}
            minLength={6}
            onChange={(event) => setEnteredRoomCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            pattern="[0-9]{6}"
            placeholder="여섯 자리 숫자"
            required
            value={enteredRoomCode}
          />
        </label>
      )}
      <label className="form-field">
        <span>닉네임</span>
        <input className="form-input" maxLength={12} onChange={(event) => setNickname(event.target.value)} required value={nickname} />
      </label>
      <button className="button-primary" type="submit">방 입장</button>
    </form>
  );
}
