// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhaseStatus } from '../apps/web/src/features/game/phase-status.js';

describe('PhaseStatus', () => {
  afterEach(cleanup);

  it('explains the current public game phase in Korean', () => {
    render(<PhaseStatus phase="night-mafia" />);

    expect(screen.getByRole('status')).toHaveTextContent('마피아는 살해할 시민을 고르세요.');
  });

  it('announces that the game has ended when a winner is decided', () => {
    render(<PhaseStatus phase="result" />);

    expect(screen.getByRole('status')).toHaveTextContent('게임 결과를 확인하는 시간');
  });

  it('tells daytime participants to choose the mafia', () => {
    render(<PhaseStatus phase="day-vote" />);

    expect(screen.getByRole('status')).toHaveTextContent('마피아를 선택해주세요.');
  });
});
