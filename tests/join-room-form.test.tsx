// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JoinRoomForm } from '../apps/web/src/features/lobby/join-room-form.js';

describe('JoinRoomForm', () => {
  afterEach(cleanup);

  it('sends the room code from the invite URL with the student nickname', () => {
    const onJoin = vi.fn();
    render(<JoinRoomForm inviteToken="0123456789abcdef0123456789abcdef" roomCode="ABCD1234" onJoin={onJoin} />);

    fireEvent.change(screen.getByLabelText('내 별명'), { target: { value: '하늘' } });
    fireEvent.click(screen.getByRole('button', { name: '방 입장' }));

    expect(onJoin).toHaveBeenCalledWith({
      roomId: 'ABCD1234',
      inviteToken: '0123456789abcdef0123456789abcdef',
      nickname: '하늘'
    });
  });
});
