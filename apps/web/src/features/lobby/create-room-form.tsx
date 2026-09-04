import { useState, type FormEvent } from 'react';

export interface CreateRoomValues {
  nickname: string;
  name: string;
  timerSeconds: number;
}

export function CreateRoomForm({ onCreate }: { onCreate: (values: CreateRoomValues) => void }) {
  const [nickname, setNickname] = useState('');
  const [name, setName] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(60);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ nickname, name, timerSeconds });
  }

  return (
    <form aria-labelledby="create-room-heading" className="lobby-card" onSubmit={submit}>
      <p className="eyebrow">마피아 게이머즈</p>
      <h2 id="create-room-heading">새 게임 만들기</h2>
      <p className="card-description">친구에게 링크를 보내고, 모두 모이면 바로 시작하세요.</p>
      <label className="form-field">
        <span>내 별명</span>
        <input className="form-input" maxLength={12} onChange={(event) => setNickname(event.target.value)} required value={nickname} />
      </label>
      <label className="form-field">
        <span>방 이름</span>
        <input className="form-input" maxLength={60} onChange={(event) => setName(event.target.value)} required value={name} />
      </label>
      <label className="form-field">
        <span>단계 시간(초)</span>
        <input className="form-input" max="600" min="10" onChange={(event) => setTimerSeconds(Number(event.target.value))} type="number" value={timerSeconds} />
      </label>
      <button className="button-primary" type="submit">방 만들기</button>
    </form>
  );
}
