// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhaseStatus } from '../apps/web/src/features/game/phase-status.js';

describe('PhaseStatus', () => {
  afterEach(cleanup);

  it('explains the current public game phase in Korean', () => {
    render(<PhaseStatus phase="night-mafia" />);

    expect(screen.getByRole('status')).toHaveTextContent('밤: 마피아가 대상을 선택하는 시간');
  });

  it('announces that the game has ended when a winner is decided', () => {
    render(<PhaseStatus phase="result" />);

    expect(screen.getByRole('status')).toHaveTextContent('게임 결과를 확인하는 시간');
  });
});
