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
  render(<PhaseWorkspace
    eliminatedNickname={null}
    canAct={true}
    isHost={false}
    mafiaPlayerIds={[]}
    onClose={vi.fn()}
    onDayVote={vi.fn()}
    onDoctorProtect={vi.fn()}
    onMafiaTarget={onMafiaTarget}
    onPoliceInvestigate={vi.fn()}
    onRematch={vi.fn()}
    phase="night-mafia"
    players={players}
    policeResult={null}
    role={null}
    voteTotals={null}
    winner={null}
    {...overrides}
  />);
  return { onMafiaTarget };
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
    expect(onMafiaTarget).toHaveBeenCalledWith('p2');
    expect(screen.queryByRole('button', { name: '하늘 선택' })).not.toBeInTheDocument();
  });

  it('keeps result management controls exclusive to the host', () => {
    renderWorkspace({ phase: 'result', winner: 'citizens' });
    expect(screen.getByText('시민 팀 승리')).toBeVisible();
    expect(screen.queryByRole('button', { name: '재경기 시작' })).not.toBeInTheDocument();

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
    expect(screen.getByText('최근 조사 결과: 선택한 참가자는 마피아입니다.')).toBeVisible();
  });
});
