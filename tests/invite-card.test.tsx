// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
});
