// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhaseWorkspace } from '../apps/web/src/features/game/phase-workspace.js';

const players = [
  { id: 'p1', nickname: '하늘', status: 'alive' as const, isHost: true },
  { id: 'p2', nickname: '바다', status: 'alive' as const, isHost: false }
];

function renderWorkspace(overrides: Partial<Parameters<typeof PhaseWorkspace>[0]> = {}) {
  const onMafiaTarget = vi.fn();
  const onLeave = vi.fn();
  render(<PhaseWorkspace
    eliminatedNickname={null}
    dayElimination={null}
    nightResult={null}
    currentPlayerId="p1"
    canAct={true}
    isHost={false}
    mafiaPlayerIds={[]}
    onClose={vi.fn()}
    onDayVote={vi.fn()}
    onDoctorProtect={vi.fn()}
    onMafiaTarget={onMafiaTarget}
    onPoliceInvestigate={vi.fn()}
    onRematch={vi.fn()}
    onReturnToLobby={vi.fn()}
    onLeave={onLeave}
    phase="night-mafia"
    players={players}
    policeResult={null}
    role={null}
    voteTotals={null}
    winner={null}
    {...overrides}
  />);
  return { onMafiaTarget, onLeave };
}

describe('PhaseWorkspace', () => {
  afterEach(cleanup);

  it('does not render a private night action for a participant without that role', () => {
    renderWorkspace();

    expect(screen.getByText('다른 참가자의 행동을 기다리고 있습니다.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /선택/ })).not.toBeInTheDocument();
  });

  it('does not render any phase action for a dead or resigned participant', () => {
    renderWorkspace({ canAct: false, mafiaPlayerIds: ['p1'], role: 'mafia' });

    expect(screen.getByText('다른 참가자의 행동을 기다리고 있습니다.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /선택/ })).not.toBeInTheDocument();
  });

  it('renders only the authorised mafia target action during the mafia phase', () => {
    const { onMafiaTarget } = renderWorkspace({ mafiaPlayerIds: ['p1'], role: 'mafia' });

    fireEvent.click(screen.getByRole('button', { name: '바다 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    expect(onMafiaTarget).toHaveBeenCalledWith('p2');
    expect(screen.queryByRole('button', { name: '하늘 선택' })).not.toBeInTheDocument();
  });

  it('keeps result management controls exclusive to the host', () => {
    const { onLeave } = renderWorkspace({ phase: 'result', winner: 'citizens' });
    expect(screen.getByText('시민 팀 승리')).toBeVisible();
    expect(screen.queryByRole('button', { name: '재경기 시작' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '게임 나가기' }));
    expect(onLeave).toHaveBeenCalledOnce();

    cleanup();
    renderWorkspace({ isHost: true, phase: 'result', winner: 'citizens' });
    expect(screen.getByRole('button', { name: '재경기 시작' })).toBeVisible();
  });

  it('keeps a police investigation result within the relevant private phase', () => {
    renderWorkspace({
      policeResult: { targetPlayerId: 'p2', alignment: 'mafia' },
      role: 'police'
    });
    expect(screen.queryByText('최근 조사 결과: 선택한 참가자는 마피아입니다.')).not.toBeInTheDocument();

    cleanup();
    renderWorkspace({
      phase: 'night-police',
      policeResult: { targetPlayerId: 'p2', alignment: 'mafia' },
      role: 'police'
    });
    expect(screen.getByText('바다님은 마피아가 맞습니다.')).toBeVisible();
  });

  it('announces the full night result during the day briefing', () => {
    renderWorkspace({
      phase: 'day-briefing',
      nightResult: { mafiaTargetPlayerId: 'p1', doctorTargetPlayerId: 'p2', eliminatedPlayerId: 'p1' }
    });

    expect(screen.getByRole('heading', { name: '밤 결과' })).toBeVisible();
    expect(screen.getByText('하늘님이 마피아에게 살해당했습니다.')).toBeVisible();
    expect(screen.getByText('의사는 바다님을 치료하였습니다.')).toBeVisible();
  });

  it('announces the exiled player and alignment as the next night starts', () => {
    renderWorkspace({
      dayElimination: { playerId: 'p2', alignment: 'citizen' },
      phase: 'night-mafia'
    });

    expect(screen.getByText('바다님이 추방되었습니다.')).toBeVisible();
    expect(screen.getByText('바다님은 시민입니다.')).toBeVisible();
  });

  it('keeps the night result visible when the night action ends the game', () => {
    renderWorkspace({
      phase: 'result',
      nightResult: { mafiaTargetPlayerId: 'p1', doctorTargetPlayerId: null, eliminatedPlayerId: 'p1' },
      winner: 'mafia'
    });

    expect(screen.getByRole('heading', { name: '밤 결과' })).toBeVisible();
  });

  it('shows the police result prominently with the investigated player name', () => {
    renderWorkspace({
      phase: 'night-police',
      policeResult: { targetPlayerId: 'p2', alignment: 'mafia' },
      role: 'police'
    });

    expect(screen.getByText('바다님은 마피아가 맞습니다.').tagName).toBe('STRONG');
  });

  it('explains the next action while the daytime result is being announced', () => {
    renderWorkspace({ phase: 'day-briefing' });

    expect(screen.getByText('밤 결과를 확인하고 낮 투표를 준비하세요.')).toBeVisible();
    expect(screen.queryByText('다른 참가자의 행동을 기다리고 있습니다.')).not.toBeInTheDocument();
  });

  it('explains that a tied daytime vote requires another choice', () => {
    renderWorkspace({ phase: 'day-revote' });

    expect(screen.getByText('동점입니다. 마피아를 다시 선택해주세요.')).toBeVisible();
  });
});
