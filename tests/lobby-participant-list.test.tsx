// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LobbyParticipantList } from '../apps/web/src/features/lobby/lobby-participant-list.js';

describe('LobbyParticipantList', () => {
  afterEach(cleanup);

  it('shows active participant nicknames to everyone in the lobby', () => {
    render(<LobbyParticipantList players={[
      { id: 'p1', nickname: 'Host', status: 'active', isHost: true },
      { id: 'p2', nickname: 'Guest', status: 'active', isHost: false },
      { id: 'p3', nickname: 'Left player', status: 'resigned', isHost: false }
    ]} />);

    expect(screen.getByRole('heading', { name: '로비 참가자' })).toBeVisible();
    expect(screen.getByRole('listitem', { name: 'Host · 방장' })).toBeVisible();
    expect(screen.getByRole('listitem', { name: 'Guest' })).toBeVisible();
    expect(screen.queryByText('Left player')).not.toBeInTheDocument();
  });
});
