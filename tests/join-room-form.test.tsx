// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JoinRoomForm } from '../apps/web/src/features/lobby/join-room-form.js';

describe('JoinRoomForm', () => {
  afterEach(cleanup);

  it('sends a manually entered six-digit room code with the student nickname', () => {
    const onJoin = vi.fn();
    render(<JoinRoomForm onJoin={onJoin} />);

    fireEvent.change(screen.getByLabelText('방 코드'), { target: { value: '012345' } });
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '하늘' } });
    fireEvent.click(screen.getByRole('button', { name: '방 입장' }));

    expect(onJoin).toHaveBeenCalledWith({ roomId: '012345', nickname: '하늘' });
  });

  it('uses the room code in an invitation link without asking for it again', () => {
    const onJoin = vi.fn();
    render(<JoinRoomForm roomCode="123456" onJoin={onJoin} />);

    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '하늘' } });
    fireEvent.click(screen.getByRole('button', { name: '방 입장' }));

    expect(onJoin).toHaveBeenCalledWith({ roomId: '123456', nickname: '하늘' });
  });
});
