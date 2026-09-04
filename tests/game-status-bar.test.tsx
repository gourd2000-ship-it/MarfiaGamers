// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameStatusBar } from '../apps/web/src/features/game/game-status-bar.js';

describe('GameStatusBar', () => {
  afterEach(cleanup);

  it('keeps the current phase and countdown together in the top status bar', () => {
    render(<GameStatusBar endsAt={new Date(Date.now() + 20_000).toISOString()} phase="day-vote" />);

    expect(screen.getByLabelText('현재 게임 상태')).toHaveClass('game-status-bar');
    expect(screen.getByRole('status')).toHaveTextContent('낮: 투표하는 시간');
    expect(screen.getByRole('timer')).toHaveTextContent(/남은 시간: \d+초/);
  });
});
