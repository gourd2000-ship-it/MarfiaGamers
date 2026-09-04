// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameStatusBar } from '../apps/web/src/features/game/game-status-bar.js';

describe('GameStatusBar', () => {
  afterEach(cleanup);

  it('keeps the current phase and countdown together in the top status bar', () => {
    render(<GameStatusBar endsAt={new Date(Date.now() + 20_000).toISOString()} phase="day-vote" />);

    expect(screen.getByLabelText('현재 게임 상태')).toHaveClass('game-status-bar');
    expect(screen.getByRole('status')).toHaveTextContent('마피아를 선택해주세요.');
    expect(screen.getByRole('timer')).toHaveTextContent(/남은 시간: \d+초/);
  });

  it('offers a host-only control to skip the remaining phase time', () => {
    const onSkip = vi.fn();
    render(<GameStatusBar endsAt={new Date(Date.now() + 20_000).toISOString()} onSkip={onSkip} phase="day-vote" />);

    fireEvent.click(screen.getByRole('button', { name: '시간 넘기기' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('prevents another skip while the previous request is pending', () => {
    render(<GameStatusBar endsAt={new Date(Date.now() + 20_000).toISOString()} isSkipping onSkip={vi.fn()} phase="day-vote" />);

    expect(screen.getByRole('button', { name: '시간 넘기기' })).toBeDisabled();
  });
});
