// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleActionPicker } from '../apps/web/src/features/game/role-action-picker.js';

describe('RoleActionPicker', () => {
  afterEach(cleanup);

  it('submits the selected active player for a private role action', async () => {
    const onSelect = vi.fn().mockResolvedValue(true);
    render(<RoleActionPicker
      actionLabel="보호"
      description="보호할 한 명을 선택하세요."
      heading="의사 행동"
      onSelect={onSelect}
      players={[
        { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
        { id: 'p2', nickname: '바다', status: 'resigned', isHost: false }
      ]}
    />);

    fireEvent.click(screen.getByRole('button', { name: '하늘 보호' }));

    expect(onSelect).toHaveBeenCalledWith('p1');
    expect(screen.queryByRole('button', { name: '바다 보호' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '하늘 보호' })).toHaveClass('player-choice');
    await waitFor(() => expect(screen.getByRole('button', { name: '하늘 보호' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByText('선택됨')).toBeVisible();
  });
});
