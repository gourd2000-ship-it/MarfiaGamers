import type { GamePhase } from '@marfia/contracts/game-presets';

const labels: Record<GamePhase, string> = {
  'role-reveal': '역할을 확인하는 시간',
  'night-mafia': '밤: 마피아가 대상을 선택하는 시간',
  'night-doctor': '밤: 의사가 보호 대상을 선택하는 시간',
  'night-police': '밤: 경찰이 조사 대상을 선택하는 시간',
  'day-briefing': '낮: 밤 결과를 확인하는 시간',
  'day-vote': '낮: 투표하는 시간',
  'day-revote': '낮: 재투표하는 시간',
  result: '게임 결과를 확인하는 시간'
};

export function PhaseStatus({ phase }: { phase: GamePhase }) {
  return <p role="status">{labels[phase]}</p>;
}
