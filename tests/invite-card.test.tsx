// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteCard } from '../apps/web/src/features/lobby/invite-card.js';

describe('InviteCard', () => {
  afterEach(cleanup);

  it('shows the shareable room URL and an accessible QR code', () => {
    render(<InviteCard inviteToken="0123456789abcdef0123456789abcdef" roomCode="ABCD1234" origin="https://mafia.school.example" />);

    expect(screen.getByLabelText('초대 링크')).toHaveValue(
      'https://mafia.school.example/room/ABCD1234?token=0123456789abcdef0123456789abcdef'
    );
    expect(screen.getByRole('img', { name: '방 입장 QR 코드' })).toBeInTheDocument();
  });

  it('copies the invite URL and confirms the action to the host', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<InviteCard inviteToken="0123456789abcdef0123456789abcdef" roomCode="ABCD1234" origin="https://mafia.school.example" />);

    fireEvent.click(screen.getByRole('button', { name: '초대 링크 복사' }));

    expect(writeText).toHaveBeenCalledWith(
      'https://mafia.school.example/room/ABCD1234?token=0123456789abcdef0123456789abcdef'
    );
    expect(await screen.findByRole('status')).toHaveTextContent('초대 링크를 복사했습니다.');
  });

  it('does not claim that a link was copied when the browser has no Clipboard API', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    render(<InviteCard inviteToken="0123456789abcdef0123456789abcdef" roomCode="ABCD1234" origin="https://mafia.school.example" />);

    fireEvent.click(screen.getByRole('button', { name: '초대 링크 복사' }));

    expect(await screen.findByRole('status')).toHaveTextContent('링크를 선택해 복사해 주세요.');
    expect(screen.getByLabelText('초대 링크')).toHaveFocus();
  });
});
