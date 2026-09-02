// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResultControls } from '../apps/web/src/features/game/result-controls.js';

describe('ResultControls', () => {
  afterEach(cleanup);

  it('offers a host controlled rematch and room close action after the result', () => {
    const onRematch = vi.fn();
    const onClose = vi.fn();
    render(<ResultControls onClose={onClose} onRematch={onRematch} />);

    fireEvent.click(screen.getByRole('button', { name: '재경기 시작' }));
    fireEvent.click(screen.getByRole('button', { name: '방 종료' }));

    expect(onRematch).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
