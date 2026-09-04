import type { PrivateRole } from '@marfia/contracts/socket-events';
import { useEffect, useState } from 'react';

const labels: Record<PrivateRole['role'], string> = {
  mafia: '마피아',
  doctor: '의사',
  police: '경찰',
  citizen: '시민'
};

export function RoleCard({ role }: PrivateRole) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => setIsRevealed(false), [role]);

  return (
    <section aria-labelledby="role-card-heading" className={`role-card role-${role}`}>
      <p className="eyebrow">비공개 정보</p>
      <h2 id="role-card-heading">나의 역할</h2>
      <button
        aria-expanded={isRevealed}
        className="role-card-toggle"
        onClick={() => setIsRevealed((value) => !value)}
        type="button"
      >
        {isRevealed ? '역할 다시 감추기' : '내 역할 확인'}
      </button>
      {isRevealed ? <p className="role-name" role="status">나의 역할: {labels[role]}</p> : null}
    </section>
  );
}
