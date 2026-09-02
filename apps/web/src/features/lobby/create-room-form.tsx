import { useState, type FormEvent } from 'react';

export interface CreateRoomValues {
  nickname: string;
  name: string;
  maxPlayers: number;
  timerSeconds: number;
}

export function CreateRoomForm({ onCreate }: { onCreate: (values: CreateRoomValues) => void }) {
  const [nickname, setNickname] = useState('');
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [timerSeconds, setTimerSeconds] = useState(60);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ nickname, name, maxPlayers, timerSeconds });
  }

  return (
    <form onSubmit={submit}>
      <label>
        내 별명
        <input maxLength={12} onChange={(event) => setNickname(event.target.value)} required value={nickname} />
      </label>
      <label>
        방 이름
        <input maxLength={60} onChange={(event) => setName(event.target.value)} required value={name} />
      </label>
      <label>
        최대 인원
        <input max="20" min="4" onChange={(event) => setMaxPlayers(Number(event.target.value))} type="number" value={maxPlayers} />
      </label>
      <label>
        단계 시간(초)
        <input max="600" min="10" onChange={(event) => setTimerSeconds(Number(event.target.value))} type="number" value={timerSeconds} />
      </label>
      <button type="submit">방 만들기</button>
    </form>
  );
}
