// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayVotePicker } from '../apps/web/src/features/game/day-vote-picker.js';

describe('DayVotePicker', () => {
  afterEach(cleanup);

  it('lets a player submit a secret ballot for an active participant', () => {
    const onVote = vi.fn();
    render(<DayVotePicker players={[
      { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
      { id: 'p2', nickname: '바다', status: 'alive', isHost: false }
    ]} onVote={onVote} />);

    fireEvent.click(screen.getByRole('button', { name: '하늘에게 투표' }));

    expect(onVote).toHaveBeenCalledWith('p1');
  });
});
