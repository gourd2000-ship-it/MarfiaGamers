// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MafiaTargetPicker } from '../apps/web/src/features/game/mafia-target-picker.js';

describe('MafiaTargetPicker', () => {
  afterEach(cleanup);

  it('submits a mafia target only after the player confirms the selected target', async () => {
    const onSelect = vi.fn().mockResolvedValue(true);
    render(<MafiaTargetPicker players={[
      { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
      { id: 'p2', nickname: '바다', status: 'alive', isHost: false },
      { id: 'p3', nickname: '별', status: 'alive', isHost: false }
    ]} excludedPlayerIds={['p1', 'p2']} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '별 선택' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '하늘 선택' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '바다 선택' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '마피아는 살해할 시민을 고르세요.' })).toHaveClass('action-picker');
    expect(screen.getByRole('button', { name: '별 선택' })).toHaveClass('player-choice');
    expect(screen.getByRole('button', { name: '별 선택' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('p3'));
    expect(screen.getByText('선택 완료')).toBeVisible();
  });
});
