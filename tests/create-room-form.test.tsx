// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateRoomForm } from '../apps/web/src/features/lobby/create-room-form.js';

describe('CreateRoomForm', () => {
  afterEach(cleanup);

  it('submits a beginner-friendly default room setup', () => {
    const onCreate = vi.fn();
    render(<CreateRoomForm onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('내 별명'), { target: { value: '방장' } });
    fireEvent.change(screen.getByLabelText('방 이름'), { target: { value: '1학년 2반' } });
    fireEvent.click(screen.getByRole('button', { name: '방 만들기' }));

    expect(onCreate).toHaveBeenCalledWith({
      nickname: '방장',
      name: '1학년 2반',
      maxPlayers: 8,
      timerSeconds: 60
    });
  });
});
