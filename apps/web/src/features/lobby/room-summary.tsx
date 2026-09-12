import type { GamePhase } from '@marfia/contracts/game-presets';
import type { RoomSummary as RoomSummaryState } from '@marfia/contracts/socket-events';
import { PhaseStatus } from '../game/phase-status.js';

export function RoomSummary({ room, phase }: { room: RoomSummaryState; phase: GamePhase | null }) {
  return (
    <div className="room-summary">
      {phase ? <PhaseStatus phase={phase} /> : <p>{room.name} 방이 만들어졌습니다. 친구가 2명 이상 모이면 게임을 시작할 수 있습니다.</p>}
      <p className="room-code">방 번호: <strong>{room.code}</strong></p>
      <p>현재 입장 인원: <strong>{room.playerCount}명</strong></p>
    </div>
  );
}
