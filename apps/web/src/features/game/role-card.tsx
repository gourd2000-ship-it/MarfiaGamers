import type { PrivateRole } from '@marfia/contracts/socket-events';

const labels: Record<PrivateRole['role'], string> = {
  mafia: '마피아',
  doctor: '의사',
  police: '경찰',
  citizen: '시민'
};

export function RoleCard({ role }: PrivateRole) {
  return <p role="status">나의 역할: {labels[role]}</p>;
}
