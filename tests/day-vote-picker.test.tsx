// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayVotePicker } from '../apps/web/src/features/game/day-vote-picker.js';

describe('DayVotePicker', () => {
  afterEach(cleanup);

  it('shows a submitted secret ballot only after the server accepts it', async () => {
    const onVote = vi.fn().mockResolvedValue(true);
    render(<DayVotePicker players={[
      { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
      { id: 'p2', nickname: '바다', status: 'alive', isHost: false }
    ]} onVote={onVote} />);

    fireEvent.click(screen.getByRole('button', { name: '하늘에게 투표' }));

    expect(onVote).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('region', { name: '비공개 투표' })).toHaveClass('action-picker');
    await waitFor(() => expect(screen.getByRole('button', { name: '하늘에게 투표' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByText('선택됨')).toBeVisible();
  });

  it('clears the pending choice when the server rejects the ballot', async () => {
    const onVote = vi.fn().mockResolvedValue(false);
    render(<DayVotePicker players={[{ id: 'p1', nickname: '하늘', status: 'alive', isHost: false }]} onVote={onVote} />);

    fireEvent.click(screen.getByRole('button', { name: '하늘에게 투표' }));

    await waitFor(() => expect(onVote).toHaveBeenCalledWith('p1'));
    expect(screen.getByRole('button', { name: '하늘에게 투표' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('선택됨')).not.toBeInTheDocument();
  });
});
