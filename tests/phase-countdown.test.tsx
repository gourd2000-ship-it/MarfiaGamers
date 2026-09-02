// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhaseCountdown } from '../apps/web/src/features/game/phase-countdown.js';

describe('PhaseCountdown', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows and updates the server-provided remaining phase time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T00:00:00.000Z'));
    render(<PhaseCountdown endsAt="2026-09-03T00:00:10.000Z" />);

    expect(screen.getByRole('timer')).toHaveTextContent('남은 시간: 10초');
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('timer')).toHaveTextContent('남은 시간: 9초');
  });
});
