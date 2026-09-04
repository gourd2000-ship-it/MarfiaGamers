// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MafiaTargetPicker } from '../apps/web/src/features/game/mafia-target-picker.js';

describe('MafiaTargetPicker', () => {
  afterEach(cleanup);

  it('lets a mafia player submit a selected target', async () => {
    const onSelect = vi.fn().mockResolvedValue(true);
    render(<MafiaTargetPicker players={[
      { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
      { id: 'p2', nickname: '바다', status: 'alive', isHost: false },
      { id: 'p3', nickname: '별', status: 'alive', isHost: false }
    ]} excludedPlayerIds={['p1', 'p2']} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '별 선택' }));

    expect(onSelect).toHaveBeenCalledWith('p3');
    expect(screen.queryByRole('button', { name: '하늘 선택' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '바다 선택' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '제거할 대상을 선택하세요' })).toHaveClass('action-picker');
    expect(screen.getByRole('button', { name: '별 선택' })).toHaveClass('player-choice');
    await waitFor(() => expect(screen.getByRole('button', { name: '별 선택' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByText('선택됨')).toBeVisible();
  });
});
