// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MafiaTargetPicker } from '../apps/web/src/features/game/mafia-target-picker.js';

describe('MafiaTargetPicker', () => {
  afterEach(cleanup);

  it('lets a mafia player submit a selected target', () => {
    const onSelect = vi.fn();
    render(<MafiaTargetPicker players={[
      { id: 'p1', nickname: '하늘', status: 'alive', isHost: false },
      { id: 'p2', nickname: '바다', status: 'alive', isHost: false },
      { id: 'p3', nickname: '별', status: 'alive', isHost: false }
    ]} excludedPlayerIds={['p1', 'p2']} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '별 선택' }));

    expect(onSelect).toHaveBeenCalledWith('p3');
    expect(screen.queryByRole('button', { name: '하늘 선택' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '바다 선택' })).not.toBeInTheDocument();
  });
});
