import type { GamePhase } from '@marfia/contracts/game-presets';

const labels: Record<GamePhase, string> = {
  'role-reveal': '역할을 확인하는 시간',
  'night-mafia': '마피아는 살해할 시민을 고르세요.',
  'night-doctor': '밤: 의사가 보호 대상을 선택하는 시간',
  'night-police': '밤: 경찰이 조사 대상을 선택하는 시간',
  'day-briefing': '낮: 밤 결과를 확인하는 시간',
  'day-vote': '마피아를 선택해주세요.',
  'day-revote': '마피아를 선택해주세요.',
  result: '게임 결과를 확인하는 시간'
};

export function PhaseStatus({ phase }: { phase: GamePhase }) {
  return <p className="phase-status" role="status">{labels[phase]}</p>;
}
