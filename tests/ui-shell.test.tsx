// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CreateRoomForm } from '../apps/web/src/features/lobby/create-room-form.js';
import { ConnectionStatus } from '../apps/web/src/components/connection-status.js';

describe('mobile UI shell', () => {
  afterEach(cleanup);

  it('gives the room creation flow a labelled card and mobile-friendly field grouping', () => {
    render(<CreateRoomForm onCreate={() => undefined} />);

    expect(screen.getByRole('heading', { name: '새 게임 만들기' })).toBeVisible();
    expect(screen.getByRole('form', { name: '새 게임 만들기' })).toHaveClass('lobby-card');
    expect(screen.getByLabelText('내 별명')).toHaveClass('form-input');
    expect(screen.getByRole('button', { name: '방 만들기' })).toHaveClass('button-primary');
  });

  it('shows a text-labelled live connection badge', () => {
    render(<ConnectionStatus state="connected" />);

    expect(screen.getByRole('status')).toHaveClass('connection-status', 'is-connected');
    expect(screen.getByRole('status')).toHaveTextContent('실시간 서버에 연결됨');
  });
});
